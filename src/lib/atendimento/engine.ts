// Lógica portada fielmente de painel_atendimento.html

export interface ContratoRow {
  nro_controle: string;
  instituicao: string;
  curso: string;
  ano_periodo: string;
}

export interface ClienteRow {
  codigo: number;
  nome_cliente: string;
  cpf?: string | null;
  telefone?: string | null;
  nro_controle?: string | null;
  status?: string | null;
  tipo?: string | null;
}

export interface AgendaRow {
  codigo: number;
  data?: string | null;
  horario?: string | null;
  studio?: string | null;
  nome_cliente?: string | null;
  nro_controle_cliente?: string | null;
  status_atend?: string | null;
}

export type TarefaStatus = "pendente" | "concluida";

export interface Tarefa {
  id: number;
  cliente_codigo: number;
  motivo: string;
  prazo?: string | null;
  status: TarefaStatus;
  concluido_em?: string | null;
}

export interface Nota {
  id: number;
  cliente_codigo: number;
  tipo: string;
  texto: string;
  autor?: string | null;
  criado_em?: string;
}

export interface Aluno {
  codigo: number;
  nome: string;
  cpf: string;
  telefone: string;
  nro_controle: string;
  status: string;
  tipo: string;
  instituicao: string;
  curso: string;
  ano_periodo: string;
  agendamentos: AgendaRow[];
  agendado: boolean;
  atendido: boolean;
  ultimoAgendamento: AgendaRow | null;
  tarefas: Tarefa[];
  tarefasPendentes: number;
}

export const SEM_PERIODO = "__sem_periodo__";

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function fmtDateTimeBR(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function chaveAlunoAgenda(nroControle?: string | null, nome?: string | null): string {
  return `${String(nroControle || "").trim()}|${String(nome || "").trim().toLowerCase()}`;
}

// filtro é só por ano (não por semestre); "9999-99" e afins são placeholder
// de contrato sem período definido, então ficam fora da lista de anos.
export function anoDoAluno(raw?: string | null): string {
  const m = (raw || "").trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!m || m[1] === "9999") return "";
  return m[1];
}

export function buildAlunos(
  clientes: ClienteRow[],
  contratos: ContratoRow[],
  agenda: AgendaRow[],
  tarefas: Tarefa[]
): { alunos: Aluno[]; agendamentosOrfaos: AgendaRow[] } {
  const contratosByNro: Record<string, ContratoRow> = {};
  contratos.forEach((c) => {
    contratosByNro[c.nro_controle] = c;
  });

  const agendaByChave: Record<string, AgendaRow[]> = {};
  agenda.forEach((a) => {
    const k = chaveAlunoAgenda(a.nro_controle_cliente, a.nome_cliente);
    if (!agendaByChave[k]) agendaByChave[k] = [];
    agendaByChave[k].push(a);
  });
  Object.keys(agendaByChave).forEach((k) => {
    agendaByChave[k].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  });

  const tarefasByCliente: Record<number, Tarefa[]> = {};
  tarefas.forEach((t) => {
    if (!tarefasByCliente[t.cliente_codigo]) tarefasByCliente[t.cliente_codigo] = [];
    tarefasByCliente[t.cliente_codigo].push(t);
  });

  const alunos: Aluno[] = clientes.map((c) => {
    const contrato = contratosByNro[c.nro_controle || ""] || null;
    const k = chaveAlunoAgenda(c.nro_controle, c.nome_cliente);
    const agendamentos = agendaByChave[k] || [];
    const tarefasDoAluno = (tarefasByCliente[c.codigo] || [])
      .slice()
      .sort((a, b) => (a.prazo || "9999-99-99").localeCompare(b.prazo || "9999-99-99"));
    const pendentes = tarefasDoAluno.filter((t) => t.status !== "concluida");
    return {
      codigo: c.codigo,
      nome: c.nome_cliente,
      cpf: c.cpf || "",
      telefone: c.telefone || "",
      nro_controle: c.nro_controle || "",
      status: c.status || "",
      tipo: c.tipo || "",
      instituicao: contrato ? contrato.instituicao : "",
      curso: contrato ? contrato.curso : "",
      ano_periodo: contrato ? contrato.ano_periodo : "",
      agendamentos,
      agendado: agendamentos.length > 0,
      atendido: agendamentos.some((a) => a.status_atend === "ATENDIDO"),
      ultimoAgendamento: agendamentos[0] || null,
      tarefas: tarefasDoAluno,
      tarefasPendentes: pendentes.length,
    };
  });

  // agendamentos cuja chave (nº de controle + nome, normalizado) não bate
  // com nenhum cliente cadastrado — provável erro de digitação no momento
  // do agendamento, que faz o registro sumir silenciosamente do painel.
  const clienteKeys = new Set(clientes.map((c) => chaveAlunoAgenda(c.nro_controle, c.nome_cliente)));
  const agendamentosOrfaos = agenda.filter(
    (a) => !clienteKeys.has(chaveAlunoAgenda(a.nro_controle_cliente, a.nome_cliente))
  );

  return { alunos, agendamentosOrfaos };
}

export interface Filters {
  ano: string;
  instituicao: string;
  agendado: "" | "sim" | "nao";
  atendido: "" | "sim" | "nao";
  search: string;
}

export const EMPTY_FILTERS: Filters = { ano: "", instituicao: "", agendado: "", atendido: "", search: "" };

export function applyFilters(alunos: Aluno[], f: Filters): Aluno[] {
  const term = f.search.trim().toLowerCase();
  return alunos.filter((a) => {
    if (f.ano === SEM_PERIODO) {
      if (anoDoAluno(a.ano_periodo)) return false;
    } else if (f.ano && anoDoAluno(a.ano_periodo) !== f.ano) return false;
    if (f.instituicao && a.instituicao !== f.instituicao) return false;
    if (f.agendado === "sim" && !a.agendado) return false;
    if (f.agendado === "nao" && a.agendado) return false;
    if (f.atendido === "sim" && !a.atendido) return false;
    if (f.atendido === "nao" && a.atendido) return false;
    if (term) {
      const alvo = `${a.nome || ""} ${a.cpf || ""} ${a.telefone || ""}`.toLowerCase();
      if (!alvo.includes(term)) return false;
    }
    return true;
  });
}

export type SortKey = keyof Pick<
  Aluno,
  "nome" | "cpf" | "telefone" | "instituicao" | "curso" | "status" | "agendado" | "atendido" | "tarefasPendentes"
>;

export function sortAlunos(list: Aluno[], key: SortKey, dir: "asc" | "desc"): Aluno[] {
  return list.slice().sort((a, b) => {
    let av: unknown = a[key];
    let bv: unknown = b[key];
    if (typeof av === "boolean" || typeof bv === "boolean") {
      av = av ? 1 : 0;
      bv = bv ? 1 : 0;
    }
    if (typeof av === "string" || typeof bv === "string") {
      const as = (av as string) || "";
      const bs = (bv as string) || "";
      return dir === "asc" ? as.localeCompare(bs, "pt-BR") : bs.localeCompare(as, "pt-BR");
    }
    const an = (av as number) || 0;
    const bn = (bv as number) || 0;
    return dir === "asc" ? an - bn : bn - an;
  });
}

export interface TarefaGlobal {
  tarefa: Tarefa;
  aluno: Aluno;
}

export function tarefasGlobaisPendentes(alunos: Aluno[]): TarefaGlobal[] {
  const itens: TarefaGlobal[] = [];
  alunos.forEach((a) => {
    a.tarefas.forEach((t) => {
      if (t.status === "concluida") return;
      itens.push({ tarefa: t, aluno: a });
    });
  });
  itens.sort((x, y) => (x.tarefa.prazo || "9999-99-99").localeCompare(y.tarefa.prazo || "9999-99-99"));
  return itens;
}

export function csvEscape(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAlunosCSV(alunos: Aluno[]): void {
  const cols = ["Nome", "CPF", "Telefone", "Instituição", "Curso", "Nº Controle", "Status", "Agendado", "Data agendamento", "Atendido"];
  const rows = alunos.map((a) => [
    a.nome,
    a.cpf,
    a.telefone,
    a.instituicao,
    a.curso,
    a.nro_controle,
    a.status,
    a.agendado ? "Sim" : "Não",
    a.ultimoAgendamento ? fmtDateBR(a.ultimoAgendamento.data) : "",
    a.atendido ? "Sim" : "Não",
  ]);
  const lines = [cols.join(";")].concat(rows.map((r) => r.map(csvEscape).join(";")));
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alunos_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
