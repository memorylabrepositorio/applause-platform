import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/cache";
import { invalidateFreelancersStaffCache } from "./fetch";
import type { CandidaturaStatus, VagaStatus } from "./engine";

// -----------------------------------------------------------------------
// cadastro / perfil (freelancer)
// -----------------------------------------------------------------------
export interface CadastroFreelancerInput {
  nomeCompleto: string;
  telefone: string;
  cidade: string;
  portfolioUrl?: string;
  equipamento?: string;
}

/** Cria a conta (Supabase Auth) e o perfil complementar em `freelancers`. */
export async function cadastrarFreelancer(email: string, senha: string, perfil: CadastroFreelancerInput) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error(
      "Conta criada, mas confirmação de e-mail pode ser necessária antes do primeiro login. Verifique sua caixa de entrada."
    );
  }

  const { error: perfilError } = await supabase.from("freelancers").insert({
    user_id: userId,
    nome_completo: perfil.nomeCompleto,
    telefone: perfil.telefone,
    email,
    cidade: perfil.cidade,
    portfolio_url: perfil.portfolioUrl || null,
    equipamento: perfil.equipamento || null,
  });
  if (perfilError) throw perfilError;

  return data;
}

export async function atualizarMeuPerfil(
  userId: string,
  campos: Partial<Pick<CadastroFreelancerInput, "nomeCompleto" | "telefone" | "cidade" | "portfolioUrl" | "equipamento">>
) {
  const { error } = await supabase
    .from("freelancers")
    .update({
      ...(campos.nomeCompleto !== undefined && { nome_completo: campos.nomeCompleto }),
      ...(campos.telefone !== undefined && { telefone: campos.telefone }),
      ...(campos.cidade !== undefined && { cidade: campos.cidade }),
      ...(campos.portfolioUrl !== undefined && { portfolio_url: campos.portfolioUrl }),
      ...(campos.equipamento !== undefined && { equipamento: campos.equipamento }),
      atualizado_em: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// candidaturas (freelancer)
// -----------------------------------------------------------------------
export async function candidatarSe(vagaId: number, freelancerId: string, mensagem?: string) {
  const { error } = await supabase.from("candidaturas_freelancer").insert({
    vaga_id: vagaId,
    freelancer_id: freelancerId,
    mensagem: mensagem || null,
  });
  if (error) throw error;
}

export async function cancelarCandidatura(candidaturaId: number) {
  const { error } = await supabase
    .from("candidaturas_freelancer")
    .update({ status: "cancelado" })
    .eq("id", candidaturaId);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// vagas (staff)
// -----------------------------------------------------------------------
export interface VagaInput {
  data: string;
  horarioInicio?: string;
  horarioFim?: string;
  instituicao?: string;
  tipoEvento?: string;
  qtdNecessaria: number;
  valorDiaria?: number;
  observacoes?: string;
}

export async function criarVaga(input: VagaInput) {
  const { error } = await supabase.from("vagas_freelancer").insert({
    data: input.data,
    horario_inicio: input.horarioInicio || null,
    horario_fim: input.horarioFim || null,
    instituicao: input.instituicao || null,
    tipo_evento: input.tipoEvento || null,
    qtd_necessaria: input.qtdNecessaria,
    valor_diaria: input.valorDiaria ?? null,
    observacoes: input.observacoes || null,
  });
  if (error) throw error;
  invalidateFreelancersStaffCache();
  invalidateCache("freelancers-staff");
}

export async function atualizarStatusVaga(vagaId: number, status: VagaStatus) {
  const { error } = await supabase
    .from("vagas_freelancer")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", vagaId);
  if (error) throw error;
  invalidateFreelancersStaffCache();
}

// -----------------------------------------------------------------------
// candidaturas (staff decide)
// -----------------------------------------------------------------------
export async function decidirCandidatura(candidaturaId: number, status: Extract<CandidaturaStatus, "aprovado" | "recusado">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("candidaturas_freelancer")
    .update({ status, decidido_em: new Date().toISOString(), decidido_por: user?.id ?? null })
    .eq("id", candidaturaId);
  if (error) throw error;
  invalidateFreelancersStaffCache();
}

export async function atualizarStatusFreelancer(userId: string, status: "ativo" | "inativo") {
  const { error } = await supabase
    .from("freelancers")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
  invalidateFreelancersStaffCache();
}
