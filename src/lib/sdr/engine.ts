// Módulo SDR — cadência de lembretes configurável + monitoramento de conversas.

export type SdrCanal = "evolution" | "meta";
export type SdrModo = "lembrete" | "conversando" | "escalado_humano" | "pausado";

export interface SdrConfig {
  id: number;
  ativo: boolean;
  canal: SdrCanal;
  janela_envio_inicio: string; // "09:00:00"
  janela_envio_fim: string;
  lembrete_sessao_dias_antes: number;
  lembrete_sessao_template: string;
  nome_agente: string;
  tom_agente: string;
  prompt_comportamento: string;
  evolution_base_url: string | null;
  evolution_instance: string | null;
  meta_phone_number_id: string | null;
  updated_at?: string;
}

export interface SdrLembrete {
  id: number;
  ordem: number;
  dias_sem_agendar: number;
  template: string;
  ativo: boolean;
  criado_em?: string;
}

export interface SdrConversa {
  cliente_codigo: number;
  telefone: string | null;
  modo: SdrModo;
  etapa_lembrete: number;
  ultimo_contato_em: string | null;
  ultima_resposta_em: string | null;
  lembrete_sessao_enviado: boolean;
  criado_em?: string;
}

export interface SdrMensagem {
  id: number;
  cliente_codigo: number;
  direcao: "saida" | "entrada";
  tipo: string;
  canal: string;
  texto: string;
  status_envio: string | null;
  erro: string | null;
  criado_em: string;
}

export const MODO_LABEL: Record<SdrModo, string> = {
  lembrete: "Lembrete automático",
  conversando: "Aluno respondeu — conversando",
  escalado_humano: "Escalado para humano",
  pausado: "Pausado",
};

export function conversaDoAluno(conversas: SdrConversa[], codigo: number): SdrConversa {
  return (
    conversas.find((c) => c.cliente_codigo === codigo) || {
      cliente_codigo: codigo,
      telefone: null,
      modo: "lembrete",
      etapa_lembrete: 0,
      ultimo_contato_em: null,
      ultima_resposta_em: null,
      lembrete_sessao_enviado: false,
    }
  );
}

export function previewTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
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
