// Módulo Produção — status de produção/edição dos itens vendidos
// (liga com a planilha de edição da Dani: produto comprado, tipo de edição,
// prazo do estúdio e prazo dado ao cliente).

export type StatusProducao = "nao_iniciado" | "em_producao" | "concluido" | "entregue";
export type OrigemLancamento = "manual" | "pronet";

export interface ProducaoItem {
  id: number;
  cliente_codigo: number;
  contrato_nro_controle: string | null;
  produto: string;
  tipo_edicao: string | null;
  prazo_estudio: string | null;
  prazo_cliente: string | null;
  status: StatusProducao;
  observacoes: string | null;
  origem: OrigemLancamento;
  criado_em?: string;
}

export interface ClienteRef {
  codigo: number;
  nome_cliente: string;
  telefone: string | null;
  nro_controle: string | null;
}

export interface ContratoRef {
  nro_controle: string;
  instituicao: string;
  curso: string;
}

export interface ProducaoItemEnriquecido extends ProducaoItem {
  clienteNome: string;
  instituicao: string;
  curso: string;
}

export const STATUS_LABEL: Record<StatusProducao, string> = {
  nao_iniciado: "Não iniciado",
  em_producao: "Em produção",
  concluido: "Concluído",
  entregue: "Entregue",
};

export const STATUS_ORDER: StatusProducao[] = ["nao_iniciado", "em_producao", "concluido", "entregue"];

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function atrasado(item: ProducaoItem): boolean {
  if (item.status === "entregue" || item.status === "concluido") return false;
  if (!item.prazo_estudio) return false;
  return item.prazo_estudio < todayISO();
}

export function enriquecerItens(
  itens: ProducaoItem[],
  clientes: ClienteRef[],
  contratos: ContratoRef[]
): ProducaoItemEnriquecido[] {
  const clientesByCodigo = new Map(clientes.map((c) => [c.codigo, c]));
  const contratosByNro = new Map(contratos.map((c) => [c.nro_controle, c]));
  return itens.map((it) => {
    const cliente = clientesByCodigo.get(it.cliente_codigo);
    const contrato = it.contrato_nro_controle ? contratosByNro.get(it.contrato_nro_controle) : undefined;
    return {
      ...it,
      clienteNome: cliente?.nome_cliente || `Cliente #${it.cliente_codigo}`,
      instituicao: contrato?.instituicao || "",
      curso: contrato?.curso || "",
    };
  });
}

export interface ProducaoFilters {
  status: "" | StatusProducao;
  search: string;
  soAtrasados: boolean;
}

export const EMPTY_FILTERS: ProducaoFilters = { status: "", search: "", soAtrasados: false };

export function applyFilters(rows: ProducaoItemEnriquecido[], f: ProducaoFilters): ProducaoItemEnriquecido[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.soAtrasados && !atrasado(r)) return false;
    if (term) {
      const alvo = `${r.clienteNome} ${r.produto} ${r.tipo_edicao || ""} ${r.contrato_nro_controle || ""} ${r.instituicao}`.toLowerCase();
      if (!alvo.includes(term)) return false;
    }
    return true;
  });
}

export interface ProducaoKpis {
  total: number;
  naoIniciado: number;
  emProducao: number;
  concluido: number;
  entregue: number;
  atrasados: number;
}

export function computeKpis(rows: ProducaoItemEnriquecido[]): ProducaoKpis {
  const kpis: ProducaoKpis = { total: rows.length, naoIniciado: 0, emProducao: 0, concluido: 0, entregue: 0, atrasados: 0 };
  rows.forEach((r) => {
    if (r.status === "nao_iniciado") kpis.naoIniciado += 1;
    else if (r.status === "em_producao") kpis.emProducao += 1;
    else if (r.status === "concluido") kpis.concluido += 1;
    else if (r.status === "entregue") kpis.entregue += 1;
    if (atrasado(r)) kpis.atrasados += 1;
  });
  return kpis;
}
