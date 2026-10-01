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
      ano_periodo: contrato?.ano_periodo ?? null,
      instituicao: contrato?.instituicao ?? null,
      curso: contrato?.curso ?? null,
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
  };
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

/** lista de anos/períodos distintos (mais recente primeiro) — pro seletor de ano */
export function listarAnos(rows: InadimplenciaEnriquecida[]): string[] {
  return Array.from(new Set(rows.map((r) => r.ano_periodo).filter((a): a is string => !!a))).sort((a, b) =>
    b.localeCompare(a, "pt-BR")
  );
}

export function fmtPct(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
