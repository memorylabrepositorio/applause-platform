// Módulo Freelancers (bloco Estúdio) — cadastro de fotógrafos freelancer,
// agenda de vagas abertas e candidaturas. Freelancer é uma conta Supabase
// Auth comum, só que sem linha em core.memberships (é isso que separa
// "equipe interna" de "conta externa" nas policies do banco).

export interface Freelancer {
  id: number;
  user_id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  portfolio_url: string | null;
  equipamento: string | null;
  observacoes: string | null;
  status: "ativo" | "inativo";
  criado_em: string;
}

export type VagaStatus = "aberta" | "fechada" | "cancelada";

export interface VagaFreelancer {
  id: number;
  data: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  instituicao: string | null;
  tipo_evento: string | null;
  qtd_necessaria: number;
  valor_diaria: number | null;
  observacoes: string | null;
  status: VagaStatus;
  criado_em: string;
}

export type CandidaturaStatus = "pendente" | "aprovado" | "recusado" | "cancelado";

export interface CandidaturaFreelancer {
  id: number;
  vaga_id: number;
  freelancer_id: string;
  status: CandidaturaStatus;
  mensagem: string | null;
  decidido_em: string | null;
  criado_em: string;
}

export const CANDIDATURA_STATUS_LABEL: Record<CandidaturaStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export const VAGA_STATUS_LABEL: Record<VagaStatus, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function fmtMoneyBR(v?: number | null): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// contagem de candidaturas aprovadas por vaga — usado pra saber se a vaga
// já preencheu a quantidade necessária de freelancers
export function aprovadosPorVaga(candidaturas: CandidaturaFreelancer[]): Record<number, number> {
  const out: Record<number, number> = {};
  candidaturas.forEach((c) => {
    if (c.status === "aprovado") out[c.vaga_id] = (out[c.vaga_id] || 0) + 1;
  });
  return out;
}

export function vagaEstaCompleta(vaga: VagaFreelancer, aprovados: Record<number, number>): boolean {
  return (aprovados[vaga.id] || 0) >= vaga.qtd_necessaria;
}
