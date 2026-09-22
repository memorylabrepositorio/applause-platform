/**
 * Motor de dados do Painel de Vendas — portado do painel_vendas_publico.html
 * original (que lia direto de vendas/contratos/clientes/agenda no Supabase).
 * A lógica de cruzamento é a mesma; só trocou de JS solto pra TS tipado.
 *
 * v1: cobre venda real cruzada com agenda (linha por item vendido). As linhas
 * sintéticas "NAO COMPROU" (aluno com contrato mas sem nenhuma venda) do
 * painel original ficam pra uma v2, junto do card de institução/produto.
 */

export interface VendaRow {
  dataVenda: string; // dd/mm/aaaa
  dataSessao: string;
  vendedor: string;
  estudio: string;
  cliente: string;
  curso: string;
  cpf: string;
  instituicao: string;
  nroControle: string;
  descricao: string;
  total: number;
  status: "" | "NAO ENCONTRADO";
}

function norm(s: unknown): string {
  return String(s ?? "").trim().toUpperCase();
}

function isoToBR(iso: unknown): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function numBR(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// nome de quem vendeu vem dentro do texto livre de observações do PDV
// ("VENDA DIRETA POR PDV. USUÁRIO: <NOME> / ...")
function extractVendedor(obs: unknown): string {
  if (!obs) return "";
  const m = /USU[ÁA]RIO:\s*([^/\n]+)/i.exec(String(obs));
  return m ? m[1].trim() : "";
}

export function monthKey(dataBR: string): string | null {
  if (!dataBR) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(dataBR.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}`;
}

// algumas pessoas aparecem com mais de uma grafia (apelido vs. nome completo)
const VENDEDOR_ALIASES: Record<string, string> = {
  LUCAS: "LUCAS DACHI",
};

export function vendedorKey(r: VendaRow): string {
  const k = norm(r.vendedor);
  if (!k) return k;
  return VENDEDOR_ALIASES[k] || k;
}

export function titleCase(s: string): string {
  const t = (s || "").trim();
  if (!t) return "—";
  return t.replace(/\S+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
}

export function vendedorLabel(r: VendaRow): string {
  return titleCase(vendedorKey(r));
}

export function estudioKey(r: VendaRow): string {
  return r.estudio && r.estudio.trim() ? norm(r.estudio) : "NÃO IDENTIFICADO";
}

export function isUnmatchedRow(r: VendaRow): boolean {
  return r.status === "NAO ENCONTRADO";
}

interface RawVenda {
  data_venda: string | null;
  nro_controle: string | null;
  cliente: string | null;
  cpf_cnpj: string | null;
  observacoes: string | null;
  descricao_item: string | null;
  total: number | string | null;
}
interface RawContrato {
  nro_controle: string | null;
  curso: string | null;
  instituicao: string | null;
}
interface RawAgenda {
  nro_controle_cliente: string | null;
  nome_cliente: string | null;
  data: string | null;
  studio: string | null;
  curso: string | null;
}

export function buildRowsFromSupabase(
  vendas: RawVenda[],
  contratos: RawContrato[],
  agenda: RawAgenda[]
): VendaRow[] {
  const contratoByControle: Record<string, RawContrato> = {};
  contratos.forEach((c) => {
    contratoByControle[norm(c.nro_controle)] = c;
  });

  const agendaByKey: Record<string, RawAgenda> = {};
  agenda.forEach((a) => {
    if (!a.nro_controle_cliente || !a.nome_cliente) return;
    const key = `${norm(a.nro_controle_cliente)}|${norm(a.nome_cliente)}`;
    if (!agendaByKey[key]) agendaByKey[key] = a;
  });

  return vendas.map((v): VendaRow => {
    const contrato = contratoByControle[norm(v.nro_controle)];
    const ag = agendaByKey[`${norm(v.nro_controle)}|${norm(v.cliente)}`];
    return {
      dataVenda: isoToBR(v.data_venda),
      dataSessao: ag ? isoToBR(ag.data) : "",
      vendedor: extractVendedor(v.observacoes),
      estudio: ag ? ag.studio || "" : "",
      cliente: v.cliente || "",
      curso: contrato?.curso || ag?.curso || "",
      cpf: v.cpf_cnpj || "",
      instituicao: contrato?.instituicao || "",
      nroControle: v.nro_controle || "",
      descricao: v.descricao_item || "",
      total: numBR(v.total),
      status: ag ? "" : "NAO ENCONTRADO",
    };
  });
}

export interface Filters {
  year?: string;
  month?: string; // "07"
  estudio?: string;
  vendedor?: string;
}

function matches(r: VendaRow, f: Filters, exclude?: keyof Filters): boolean {
  const mk = monthKey(r.dataVenda);
  const year = mk ? mk.split("-")[0] : null;
  const month = mk ? mk.split("-")[1] : null;
  if (exclude !== "year" && f.year && year !== f.year) return false;
  if (exclude !== "month" && f.month && month !== f.month) return false;
  if (exclude !== "estudio" && f.estudio && estudioKey(r) !== f.estudio) return false;
  if (exclude !== "vendedor" && f.vendedor && vendedorKey(r) !== f.vendedor) return false;
  return true;
}

export function applyFilters(rows: VendaRow[], f: Filters, exclude?: keyof Filters): VendaRow[] {
  return rows.filter((r) => matches(r, f, exclude));
}

export interface VendedorStats {
  key: string;
  label: string;
  revenue: number;
  items: number;
  matched: number;
  unmatched: number;
  ticket: number;
  conv: number;
}

export function computeVendedorStats(rows: VendaRow[]): VendedorStats[] {
  const map: Record<string, VendedorStats> = {};
  rows.forEach((r) => {
    const vk = vendedorKey(r);
    if (!vk) return;
    if (!map[vk]) {
      map[vk] = {
        key: vk,
        label: vendedorLabel(r),
        revenue: 0,
        items: 0,
        matched: 0,
        unmatched: 0,
        ticket: 0,
        conv: 0,
      };
    }
    map[vk].revenue += r.total;
    map[vk].items += 1;
    if (isUnmatchedRow(r)) map[vk].unmatched += 1;
    else map[vk].matched += 1;
  });
  return Object.values(map).map((v) => {
    const tot = v.matched + v.unmatched;
    return { ...v, ticket: v.items ? v.revenue / v.items : 0, conv: tot ? (v.matched / tot) * 100 : 0 };
  });
}

export interface MonthPoint {
  key: string; // "2026-01"
  label: string;
  revenue: number;
  items: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthlySeries(rows: VendaRow[], year?: string): MonthPoint[] {
  const y = year || String(new Date().getFullYear());
  const points: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({
    key: `${y}-${String(i + 1).padStart(2, "0")}`,
    label: MESES[i],
    revenue: 0,
    items: 0,
  }));
  const byKey = Object.fromEntries(points.map((p) => [p.key, p]));
  rows.forEach((r) => {
    const mk = monthKey(r.dataVenda);
    if (mk && byKey[mk]) {
      byKey[mk].revenue += r.total;
      byKey[mk].items += 1;
    }
  });
  return points;
}

export function estudioBreakdown(rows: VendaRow[]): { label: string; value: number }[] {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    const k = estudioKey(r);
    map[k] = (map[k] || 0) + r.total;
  });
  return Object.entries(map)
    .map(([k, value]) => ({ label: titleCase(k), value }))
    .sort((a, b) => b.value - a.value);
}
