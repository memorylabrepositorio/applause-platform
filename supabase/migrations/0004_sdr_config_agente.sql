-- Comportamento do agente + campos NÃO sensíveis das integrações
-- (URL/instância/ID). As chaves de fato (API key, access token) continuam
-- de fora do banco — ficam como secrets das Edge Functions, geridas pela
-- tela de Configurações através da Management API do Supabase.

alter table public.sdr_config
  add column if not exists nome_agente text not null default 'Applause',
  add column if not exists tom_agente text not null default 'cordial e objetivo',
  add column if not exists prompt_comportamento text not null default 'Você é o assistente da Applause Formaturas, falando com um aluno pelo WhatsApp. Seja breve, cordial e direto. Seu objetivo principal é ajudar o aluno a agendar a sessão de fotos da formatura. Se ele tiver dúvidas sobre o processo, responda com clareza; se a dúvida fugir do que você sabe, diga que vai chamar alguém do time para ajudar. Nunca invente informações sobre preços, datas ou políticas que você não tem certeza.',
  add column if not exists evolution_base_url text,
  add column if not exists evolution_instance text,
  add column if not exists meta_phone_number_id text;
