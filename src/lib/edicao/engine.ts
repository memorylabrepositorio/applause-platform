// Módulo Edição — produção do ano corrente (convites/fotolivro/vídeo) e o
// funil de aprovação de álbuns. Mesmo espírito do módulo Produção: dado que
// hoje vem de planilha ('planilha'), amanhã pode nascer direto no painel
// ('manual') ou vir da automação do Pronet ('pronet').

export type OrigemLancamento = "manual" | "planilha" | "pronet";

export interface ProducaoEdicaoItem {
  id: number;
  cliente_codigo: number | null;
  aluno: string;
  instituicao: string | null;
  curso: string | null;
  observacao: string | null;
  financeiro: string | null;
  estudio: string | null;
  data_sessao: string | null;
  data_lancamento: string | null;
  data_limite: string | null;
  entrada_edicao: string | null;
  saida_edicao: string | null;
  editor: string | null;
  fotolivro: string | null;
  produto: string | null;
  qtdd: string | null;
  link_drive: string | null;
  depoimento: string | null;
  quadro: string | null;
  vendedor: string | null;
  origem: OrigemLancamento;
}

export type FunilStatus = "tarefas" | "em_aprovacao" | "em_espera_grafica" | "aprovado";

export interface FunilAlbunsItem {
  id: number;
  cliente_codigo: number | null;
  producao_edicao_id: number | null;
  aluno: string;
  instituicao: string | null;
  curso: string | null;
  local: string | null;
  tamanho_fotolivro: string | null;
  status: FunilStatus;
  data_recebimento: string | null;
  prazo: string | null;
  observacoes: string | null;
  data_envio_aprovacao: string | null;
  data_envio_pamecolor: string | null;
  data_recebimento_album: string | null;
  data_retirada_cliente: string | null;
  codigo: string | null;
  origem: OrigemLancamento;
}

export const FUNIL_STATUS_LABEL: Record<FunilStatus, string> = {
  tarefas: "Tarefas",
  em_aprovacao: "Em aprovação",
  em_espera_grafica: "Em espera pra gráfica",
  aprovado: "Aprovado",
};

export const FUNIL_STATUS_ORDER: FunilStatus[] = ["tarefas", "em_aprovacao", "em_espera_grafica", "aprovado"];

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// status de produção deduzido pelas datas — a planilha não tinha uma coluna
// de status própria pra isso, só entrada/saída de edição + data limite
export type StatusEdicao = "aguardando" | "em_edicao" | "atrasado" | "concluido";

export const STATUS_EDICAO_LABEL: Record<StatusEdicao, string> = {
  aguardando: "Aguardando entrada",
  em_edicao: "Em edição",
  atrasado: "Atrasado",
  concluido: "Concluído",
};

export const STATUS_EDICAO_ORDER: StatusEdicao[] = ["aguardando", "em_edicao", "atrasado", "concluido"];

export function statusEdicao(it: ProducaoEdicaoItem): StatusEdicao {
  if (it.saida_edicao) return "concluido";
  if (it.data_limite && it.data_limite < todayISO()) return "atrasado";
  if (it.entrada_edicao) return "em_edicao";
  return "aguardando";
}

export interface EdicaoKpis {
  total: number;
  emEdicao: number;
  atrasados: number;
  aguardando: number;
  concluidosNoMes: number;
}

export function computeKpis(itens: ProducaoEdicaoItem[]): EdicaoKpis {
  const kpis: EdicaoKpis = { total: itens.length, emEdicao: 0, atrasados: 0, aguardando: 0, concluidosNoMes: 0 };
  const mesAtual = todayISO().slice(0, 7);
  itens.forEach((it) => {
    const s = statusEdicao(it);
    if (s === "em_edicao") kpis.emEdicao += 1;
    else if (s === "atrasado") kpis.atrasados += 1;
    else if (s === "aguardando") kpis.aguardando += 1;
    else if (s === "concluido" && it.saida_edicao && it.saida_edicao.slice(0, 7) === mesAtual) kpis.concluidosNoMes += 1;
  });
  return kpis;
}

export function funilCounts(itens: FunilAlbunsItem[]): Record<FunilStatus, number> {
  const counts: Record<FunilStatus, number> = { tarefas: 0, em_aprovacao: 0, em_espera_grafica: 0, aprovado: 0 };
  itens.forEach((it) => {
    counts[it.status] = (counts[it.status] || 0) + 1;
  });
  return counts;
}

export interface EditorVolume {
  editor: string;
  total: number;
}

export function volumePorEditor(itens: ProducaoEdicaoItem[], limite = 8): EditorVolume[] {
  const mapa = new Map<string, number>();
  itens.forEach((it) => {
    const nome = (it.editor || "").trim();
    if (!nome) return;
    mapa.set(nome, (mapa.get(nome) || 0) + 1);
  });
  return Array.from(mapa.entries())
    .map(([editor, total]) => ({ editor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

export interface EdicaoFilters {
  status: "" | StatusEdicao;
  editor: string;
  search: string;
}

export const EMPTY_FILTERS: EdicaoFilters = { status: "", editor: "", search: "" };

export function applyFilters(itens: ProducaoEdicaoItem[], f: EdicaoFilters): ProducaoEdicaoItem[] {
  const term = f.search.trim().toLowerCase();
  return itens.filter((it) => {
    if (f.status && statusEdicao(it) !== f.status) return false;
    if (f.editor && (it.editor || "") !== f.editor) return false;
    if (term) {
      const alvo = `${it.aluno} ${it.instituicao || ""} ${it.curso || ""} ${it.editor || ""} ${it.vendedor || ""}`.toLowerCase();
      if (!alvo.includes(term)) return false;
    }
    return true;
  });
}
