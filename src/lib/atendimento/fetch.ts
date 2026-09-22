import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import { buildAlunos, type AgendaRow, type ClienteRow, type ContratoRow, type Nota, type Tarefa } from "./engine";

export interface AtendimentoData {
  alunos: ReturnType<typeof buildAlunos>["alunos"];
  agendamentosOrfaos: AgendaRow[];
  notas: Nota[];
  tarefas: Tarefa[];
}

export async function loadAtendimentoData(): Promise<AtendimentoData> {
  const [contratos, clientes, agenda, notas, tarefas] = await Promise.all([
    fetchAllRows<ContratoRow>("contratos", "nro_controle,instituicao,curso,ano_periodo"),
    fetchAllRows<ClienteRow>("clientes", "codigo,nome_cliente,cpf,telefone,nro_controle,status,tipo"),
    fetchAllRows<AgendaRow>("agenda", "codigo,data,horario,studio,nome_cliente,nro_controle_cliente,status_atend"),
    fetchAllRows<Nota>("atendimento_notas"),
    fetchAllRows<Tarefa>("atendimento_tarefas"),
  ]);
  const { alunos, agendamentosOrfaos } = buildAlunos(clientes, contratos, agenda, tarefas);
  return { alunos, agendamentosOrfaos, notas, tarefas };
}

export async function getCurrentUserEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email || "";
}

export async function concluirTarefa(id: number): Promise<void> {
  const { error } = await supabase
    .from("atendimento_tarefas")
    .update({ status: "concluida", concluido_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function criarTarefa(clienteCodigo: number, motivo: string, prazo: string | null): Promise<Tarefa> {
  const payload = { cliente_codigo: clienteCodigo, motivo, prazo, status: "pendente" };
  const { data, error } = await supabase.from("atendimento_tarefas").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao criar tarefa");
  return data[0] as Tarefa;
}

export async function criarNota(
  clienteCodigo: number,
  tipo: string,
  texto: string,
  autor: string | null
): Promise<Nota> {
  const payload = { cliente_codigo: clienteCodigo, tipo, texto, autor };
  const { data, error } = await supabase.from("atendimento_notas").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao salvar anotação");
  return data[0] as Nota;
}
