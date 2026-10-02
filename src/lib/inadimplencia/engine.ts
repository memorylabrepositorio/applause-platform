export interface InadimplenciaResumo {
  id: number;
  contrato_nro_controle: string;
  cliente_nome: string;
  item_seq: number;
  valor_contratado: number;
  valor_faturado: number;
  valor_pendente: number;
  valor_quitado: number;
  valor_a_vencer: number;
  valor_inadimplente: number;
  percentual_inadimplente: number;
  referencia_em: string;
  origem: string;
}

// versão com dados cruzados de contratos (instituição/curso/ano) e clientes
// (CPF/telefone/status) — pra mostrar no popup do aluno e no filtro de ano
export interface InadimplenciaEnriquecida extends InadimplenciaResumo {
  ano_periodo: string | null;
  instituicao: string | null;
  curso: string | null;
  clienteCpf: string | null;
  clienteTelefone: string | null;
  clienteStatus: string | null;
  clienteTipo: string | null;
  /** false quando não achamos esse aluno em `clientes` pelo nome — o relatório não tem código numérico */
  clienteEncontrado: boolean;
}

interface ContratoInfo {
  nro_controle: string;
  instituicao: string;
  curso: string;
  ano_periodo?: string | null;
}

interface ClienteInfo {
  nome_cliente: string;
  nro_controle?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  status?: string | null;
  tipo?: string | null;
}

/**
 * o `ano_periodo` vem direto do Pronet com formatos inconsistentes (ex: "2026-2",
 * "2026-02", "2023-" com o semestre em branco) e usa "9999-99" como sentinela de
 * "sem período definido". Normaliza pra só o ano (ex: "2026") — os semestres do
 * mesmo ano são juntados numa única opção — e descarta os sentinelas/lixo (retorna null).
 */
export function normalizarAnoPeriodo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-?(\d{1,2})?$/.exec(raw.trim());
  if (!m) return raw.trim() || null;
  const ano = Number(m[1]);
  if (!ano || ano >= 9000) return null;
  return String(ano);
}

/** o Pronet usa placeholders tipo "** NÃO DEFINIDO **" / "NAO DEFINIDO" / "N/D" quando o
 * campo não foi preenchido — trata como vazio (null) em vez de mostrar esse texto cru na tela */
function normalizarTextoPronet(s: string | null | undefined): string | null {
  if (!s) return null;
  const limpo = s.trim();
  if (!limpo) return null;
  const semSimbolos = limpo.replace(/\*/g, "").trim();
  const norm = normalizarNome(semSimbolos);
  if (["NAO DEFINIDO", "NAO DEFINIDA", "INDEFINIDO", "INDEFINIDA", "N/D", "N/A", "-"].includes(norm)) return null;
  return limpo;
}

function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** cruza o relatório (sem código numérico de cliente) com contratos/clientes pelo nome + nº de controle */
export function enriquecerInadimplencia(
  rows: InadimplenciaResumo[],
  contratos: ContratoInfo[],
  clientes: ClienteInfo[]
): InadimplenciaEnriquecida[] {
  const contratoPorNro = new Map(contratos.map((c) => [c.nro_controle, c]));

  const clientePorNomeEContrato = new Map<string, ClienteInfo>();
  const clientePorNome = new Map<string, ClienteInfo>();
  for (const c of clientes) {
    const nome = normalizarNome(c.nome_cliente);
    if (c.nro_controle) clientePorNomeEContrato.set(nome + "|" + c.nro_controle, c);
    if (!clientePorNome.has(nome)) clientePorNome.set(nome, c);
  }

  return rows.map((r) => {
    const contrato = contratoPorNro.get(r.contrato_nro_controle);
    const nomeNorm = normalizarNome(r.cliente_nome);
    const cliente =
      clientePorNomeEContrato.get(nomeNorm + "|" + r.contrato_nro_controle) || clientePorNome.get(nomeNorm);
    return {
      ...r,
      ano_periodo: normalizarAnoPeriodo(contrato?.ano_periodo),
      instituicao: normalizarTextoPronet(contrato?.instituicao),
      curso: normalizarTextoPronet(contrato?.curso),
      clienteCpf: cliente?.cpf ?? null,
      clienteTelefone: cliente?.telefone ?? null,
      clienteStatus: cliente?.status ?? null,
      clienteTipo: cliente?.tipo ?? null,
      clienteEncontrado: !!cliente,
    };
  });
}

export interface InadimplenciaKpis {
  totalInadimplente: number;
  /** % ponderado pelo valor contratado de todo o relatório (não a média simples das linhas) */
  percentualMedio: number;
  contratosAfetados: number;
  registrosInadimplentes: number;
  referenciaEm: string | null;
}

export function computeInadimplenciaKpis(rows: InadimplenciaResumo[]): InadimplenciaKpis {
  const inadimplentes = rows.filter((r) => r.valor_inadimplente > 0);
  const totalInadimplente = inadimplentes.reduce((s, r) => s + r.valor_inadimplente, 0);
  const totalContratado = rows.reduce((s, r) => s + r.valor_contratado, 0);
  const percentualMedio = totalContratado > 0 ? (totalInadimplente / totalContratado) * 100 : 0;
  const contratosAfetados = new Set(inadimplentes.map((r) => r.contrato_nro_controle)).size;
  const referenciaEm = rows.length
    ? rows.reduce((max, r) => (r.referencia_em > max ? r.referencia_em : max), rows[0].referencia_em)
    : null;
  return {
    totalInadimplente,
    percentualMedio,
    contratosAfetados,
    registrosInadimplentes: inadimplentes.length,
    referenciaEm,
  };
}

/** totais de um contrato específico — usado no painel superior quando o usuário clica num contrato */
export interface ContratoResumo {
  contrato: string;
  instituicao: string | null;
  curso: string | null;
  ano_periodo: string | null;
  contratado: number;
  faturado: number;
  quitado: number;
  pendente: number;
  aVencer: number;
  inadimplente: number;
  alunos: number;
  /** quantos alunos distintos têm inadimplência > 0 — diferente de `alunos`, que conta todos */
  alunosInadimplentes: number;
}

function contarAlunosInadimplentes(rows: InadimplenciaEnriquecida[]): number {
  return new Set(rows.filter((r) => r.valor_inadimplente > 0).map((r) => r.cliente_nome)).size;
}

/** totais de TODOS os contratos juntos — usado no topo do painel quando nenhum contrato está selecionado */
export function computeResumoGeral(rows: InadimplenciaEnriquecida[]): ContratoResumo | null {
  if (!rows.length) return null;
  return {
    contrato: "",
    instituicao: null,
    curso: null,
    ano_periodo: null,
    contratado: rows.reduce((s, r) => s + r.valor_contratado, 0),
    faturado: rows.reduce((s, r) => s + r.valor_faturado, 0),
    quitado: rows.reduce((s, r) => s + r.valor_quitado, 0),
    pendente: rows.reduce((s, r) => s + r.valor_pendente, 0),
    aVencer: rows.reduce((s, r) => s + r.valor_a_vencer, 0),
    inadimplente: rows.reduce((s, r) => s + r.valor_inadimplente, 0),
    alunos: new Set(rows.map((r) => r.cliente_nome)).size,
    alunosInadimplentes: contarAlunosInadimplentes(rows),
  };
}

export function computeContratoResumo(rows: InadimplenciaEnriquecida[], contrato: string): ContratoResumo | null {
  const doContrato = rows.filter((r) => r.contrato_nro_controle === contrato);
  if (!doContrato.length) return null;
  return {
    contrato,
    instituicao: doContrato[0].instituicao,
    curso: doContrato[0].curso,
    ano_periodo: doContrato[0].ano_periodo,
    contratado: doContrato.reduce((s, r) => s + r.valor_contratado, 0),
    faturado: doContrato.reduce((s, r) => s + r.valor_faturado, 0),
    quitado: doContrato.reduce((s, r) => s + r.valor_quitado, 0),
    pendente: doContrato.reduce((s, r) => s + r.valor_pendente, 0),
    aVencer: doContrato.reduce((s, r) => s + r.valor_a_vencer, 0),
    inadimplente: doContrato.reduce((s, r) => s + r.valor_inadimplente, 0),
    alunos: new Set(doContrato.map((r) => r.cliente_nome)).size,
    alunosInadimplentes: contarAlunosInadimplentes(doContrato),
  };
}

/** agrupa por contrato de uma vez só — usado nos relatórios (Excel/PPTX) pra não rodar computeContratoResumo N vezes */
export function listarResumoPorContrato(rows: InadimplenciaEnriquecida[]): ContratoResumo[] {
  const porContrato = new Map<string, InadimplenciaEnriquecida[]>();
  for (const r of rows) {
    const arr = porContrato.get(r.contrato_nro_controle);
    if (arr) arr.push(r);
    else porContrato.set(r.contrato_nro_controle, [r]);
  }
  return Array.from(porContrato.entries())
    .map(([contrato, doContrato]) => ({
      contrato,
      instituicao: doContrato[0].instituicao,
      curso: doContrato[0].curso,
      ano_periodo: doContrato[0].ano_periodo,
      contratado: doContrato.reduce((s, r) => s + r.valor_contratado, 0),
      faturado: doContrato.reduce((s, r) => s + r.valor_faturado, 0),
      quitado: doContrato.reduce((s, r) => s + r.valor_quitado, 0),
      pendente: doContrato.reduce((s, r) => s + r.valor_pendente, 0),
      aVencer: doContrato.reduce((s, r) => s + r.valor_a_vencer, 0),
      inadimplente: doContrato.reduce((s, r) => s + r.valor_inadimplente, 0),
      alunos: new Set(doContrato.map((r) => r.cliente_nome)).size,
      alunosInadimplentes: contarAlunosInadimplentes(doContrato),
    }))
    .sort((a, b) => b.inadimplente - a.inadimplente);
}

export interface ResumoInstituicao {
  instituicao: string;
  contratado: number;
  quitado: number;
  pendente: number;
  inadimplente: number;
}

/** agrupa por instituição — usado no gráfico da apresentação */
export function listarResumoPorInstituicao(rows: InadimplenciaEnriquecida[]): ResumoInstituicao[] {
  const porInst = new Map<string, InadimplenciaEnriquecida[]>();
  for (const r of rows) {
    const key = r.instituicao || "Não identificada";
    const arr = porInst.get(key);
    if (arr) arr.push(r);
    else porInst.set(key, [r]);
  }
  return Array.from(porInst.entries())
    .map(([instituicao, doInst]) => ({
      instituicao,
      contratado: doInst.reduce((s, r) => s + r.valor_contratado, 0),
      quitado: doInst.reduce((s, r) => s + r.valor_quitado, 0),
      pendente: doInst.reduce((s, r) => s + r.valor_pendente, 0),
      inadimplente: doInst.reduce((s, r) => s + r.valor_inadimplente, 0),
    }))
    .sort((a, b) => b.inadimplente - a.inadimplente);
}

export interface InadimplenciaFilters {
  search: string;
  apenasInadimplentes: boolean;
  /** "" = todos os contratos */
  contrato: string;
  /** "" = todos os anos */
  ano: string;
}

export const EMPTY_INAD_FILTERS: InadimplenciaFilters = {
  search: "",
  apenasInadimplentes: true,
  contrato: "",
  ano: "",
};

export function applyInadimplenciaFilters(
  rows: InadimplenciaEnriquecida[],
  filters: InadimplenciaFilters
): InadimplenciaEnriquecida[] {
  let out = rows;
  if (filters.apenasInadimplentes) out = out.filter((r) => r.valor_inadimplente > 0);
  if (filters.contrato) out = out.filter((r) => r.contrato_nro_controle === filters.contrato);
  if (filters.ano) out = out.filter((r) => r.ano_periodo === filters.ano);
  const q = filters.search.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) => r.cliente_nome.toLowerCase().includes(q) || r.contrato_nro_controle.toLowerCase().includes(q)
    );
  }
  return out;
}

/** lista de contratos distintos presentes nos dados, ordenada alfabeticamente — pro seletor de contrato */
export function listarContratos(rows: { contrato_nro_controle: string }[]): string[] {
  return Array.from(new Set(rows.map((r) => r.contrato_nro_controle))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

/** lista de anos/períodos distintos (mais recente primeiro) — pro seletor de ano.
 * ordena numericamente por ano e depois por semestre, não por string (evita "9999-99"
 * aparecer no topo e "2026-2"/"2026-02" ficarem fora de ordem) */
export function listarAnos(rows: InadimplenciaEnriquecida[]): string[] {
  const valores = Array.from(new Set(rows.map((r) => r.ano_periodo).filter((a): a is string => !!a)));
  return valores.sort((a, b) => Number(b) - Number(a));
}

export function fmtPct(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
