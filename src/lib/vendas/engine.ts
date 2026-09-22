/**
 * Motor de dados do Painel de Vendas — portado do painel_vendas_publico.html
 * original (que lia direto de vendas/contratos/clientes/agenda no Supabase).
 * A lógica de cruzamento é a mesma; só trocou de JS solto pra TS tipado.
 */

export interface VendaRow {
  dataVenda: string; // dd/mm/aaaa, vazio na linha sintética "não comprou"
  dataSessao: string;
  vendedor: string;
  estudio: string;
  cliente: string;
  curso: string;
  cpf: string;
  instituicao: string;
  nroControle: string;
  descricao: string; // "NAO COMPROU" na linha sintética
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

// "Sessão Estúdio" é uma tag que mora no campo Nº Controle (não em Curso) —
// marca venda avulsa de estúdio em vez de venda via instituição/turma
function isSessaoEstudio(r: VendaRow): boolean {
  const c = norm(r.nroControle);
  return c === "SESSÃO ESTÚDIO" || c === "SESSAO ESTUDIO";
}

// instituição vem do contrato; quando falta, muita venda direta de PDV deixa
// o texto da instituição/turma dentro do próprio Nº Controle
export function institutionLabelOf(r: VendaRow): string | null {
  const inst = r.instituicao?.trim();
  if (inst) {
    const ni = norm(inst);
    if (!ni.includes("NÃO INFORMADO") && !ni.includes("NAO INFORMADO") && ni !== "-") return inst;
  }
  if (!isSessaoEstudio(r)) {
    const ctrl = r.nroControle?.trim();
    if (ctrl && norm(ctrl) !== "-") return ctrl;
  }
  return null;
}

export function comprouStatus(r: VendaRow): "sim" | "nao" {
  const d = norm(r.descricao);
  return d === "NAO COMPROU" || d === "NÃO COMPROU" ? "nao" : "sim";
}

export function agendaStatus(r: VendaRow): "sim" | "nao" {
  return isUnmatchedRow(r) ? "nao" : "sim";
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
interface RawCliente {
  nro_controle: string | null;
  nome_cliente: string | null;
  cpf: string | null;
}

// reconstrói, a partir das 4 tabelas reais, a mesma estrutura de linhas do
// painel original: 1 linha por item vendido (cruzado com a agenda daquele
// cliente), mais 1 linha sintética "NAO COMPROU" por aluno com contrato mas
// sem nenhuma venda — assim os cartões de comprou/não comprou continuam
// usando clientes×contratos como fonte de verdade.
export function buildRowsFromSupabase(
  vendas: RawVenda[],
  contratos: RawContrato[],
  clientes: RawCliente[],
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

  const rows: VendaRow[] = [];
  const compraKeys = new Set<string>();

  vendas.forEach((v) => {
    const contrato = contratoByControle[norm(v.nro_controle)];
    const ag = agendaByKey[`${norm(v.nro_controle)}|${norm(v.cliente)}`];
    rows.push({
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
    });
    compraKeys.add(`${norm(v.nro_controle)}|${norm(v.cliente)}`);
    if (v.cpf_cnpj) compraKeys.add(`cpf:${norm(v.cpf_cnpj)}`);
  });

  clientes.forEach((c) => {
    if (!c.nome_cliente) return;
    const pairKey = `${norm(c.nro_controle)}|${norm(c.nome_cliente)}`;
    const cpfKey = c.cpf ? `cpf:${norm(c.cpf)}` : null;
    if (compraKeys.has(pairKey) || (cpfKey && compraKeys.has(cpfKey))) return;
    const contrato = contratoByControle[norm(c.nro_controle)];
    const ag = agendaByKey[pairKey];
    rows.push({
      dataVenda: "",
      dataSessao: ag ? isoToBR(ag.data) : "",
      vendedor: "",
      estudio: ag ? ag.studio || "" : "",
      cliente: c.nome_cliente,
      curso: contrato?.curso || "",
      cpf: c.cpf || "",
      instituicao: contrato?.instituicao || "",
      nroControle: c.nro_controle || "",
      descricao: "NAO COMPROU",
      total: 0,
      status: ag ? "" : "NAO ENCONTRADO",
    });
  });

  return rows;
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

function topWithOthers(map: Record<string, number>, limit: number): { label: string; value: number }[] {
  const arr = Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  if (arr.length <= limit) return arr;
  const top = arr.slice(0, limit);
  const restSum = arr.slice(limit).reduce((s, d) => s + d.value, 0);
  top.push({ label: "Outros", value: restSum });
  return top;
}

export function institutionBreakdown(rows: VendaRow[]): { label: string; value: number }[] {
  const map: Record<string, number> = {};
  const labelOf: Record<string, string> = {};
  rows.forEach((r) => {
    const raw = institutionLabelOf(r);
    if (!raw) return;
    const k = norm(raw);
    map[k] = (map[k] || 0) + r.total;
    if (!labelOf[k]) labelOf[k] = raw;
  });
  return Object.entries(map)
    .map(([k, value]) => ({ label: titleCase(labelOf[k]), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function productBreakdown(rows: VendaRow[]): { label: string; value: number }[] {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    const pk = r.descricao?.trim() ? titleCase(r.descricao) : "Não informado";
    map[pk] = (map[pk] || 0) + r.total;
  });
  return topWithOthers(map, 7);
}
