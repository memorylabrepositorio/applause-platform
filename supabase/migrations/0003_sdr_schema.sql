-- Módulo SDR (agente de IA) — lembretes automáticos de agendamento por WhatsApp.
--
-- Tabelas:
--   sdr_config      -> configuração geral (liga/desliga, canal ativo, janela de envio)
--   sdr_lembretes   -> cadência configurável (dias sem agendar -> qual mensagem enviar)
--   sdr_conversas   -> estado por aluno (em qual etapa está, se já respondeu, se escalou)
--   sdr_mensagens   -> log de tudo que foi enviado/recebido

-- Atenção: esta tabela guarda só configuração NÃO sensível. Chaves de API
-- (Evolution API, Meta) ficam como secrets da Edge Function (variáveis de
-- ambiente), nunca aqui — qualquer usuário logado no painel consegue ler
-- linhas desta tabela pelo navegador, então nada de senha/token aqui.
create table if not exists public.sdr_config (
  id int primary key default 1,
  ativo boolean not null default false,
  canal text not null default 'evolution' check (canal in ('evolution', 'meta')),
  janela_envio_inicio time not null default '09:00',
  janela_envio_fim time not null default '19:00',
  lembrete_sessao_dias_antes int not null default 2,
  lembrete_sessao_template text not null default 'Oi {{nome}}! Passando pra lembrar que sua sessão de fotos é dia {{data_sessao}}{{#horario}} às {{horario}}{{/horario}}. Qualquer dúvida é só chamar por aqui 😊',
  updated_at timestamptz not null default now(),
  constraint sdr_config_singleton check (id = 1)
);

insert into public.sdr_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.sdr_lembretes (
  id bigint generated always as identity primary key,
  ordem int not null,
  dias_sem_agendar int not null,
  template text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index if not exists sdr_lembretes_ordem_key on public.sdr_lembretes (ordem);

-- cadência padrão sugerida (o usuário pode editar tudo isso pelo painel)
insert into public.sdr_lembretes (ordem, dias_sem_agendar, template)
values
  (1, 3, 'Oi {{nome}}! Vi aqui que sua sessão de fotos da formatura ainda não foi agendada. Quer que eu te ajude a marcar um horário? 📸'),
  (2, 7, 'Oi {{nome}}, tudo bem? Só passando pra lembrar de novo: sua sessão de fotos ainda tá sem data marcada. Me chama por aqui que eu te ajudo a agendar!'),
  (3, 14, '{{nome}}, sua sessão de fotos ainda está pendente de agendamento. Se precisar de ajuda ou tiver alguma dúvida, é só responder essa mensagem que alguém do nosso time vai te ajudar.')
on conflict (ordem) do nothing;

create table if not exists public.sdr_conversas (
  cliente_codigo bigint primary key,
  telefone text,
  modo text not null default 'lembrete' check (modo in ('lembrete', 'conversando', 'escalado_humano', 'pausado')),
  etapa_lembrete int not null default 0,
  ultimo_contato_em timestamptz,
  ultima_resposta_em timestamptz,
  lembrete_sessao_enviado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.sdr_mensagens (
  id bigint generated always as identity primary key,
  cliente_codigo bigint not null,
  direcao text not null check (direcao in ('saida', 'entrada')),
  tipo text not null check (tipo in ('lembrete_agendamento', 'lembrete_sessao', 'resposta_ia', 'mensagem_aluno', 'nota_humana')),
  canal text not null default 'evolution',
  texto text not null,
  status_envio text,
  erro text,
  criado_em timestamptz not null default now()
);

create index if not exists sdr_mensagens_cliente_idx on public.sdr_mensagens (cliente_codigo, criado_em desc);

-- RLS: ferramenta interna de uma única organização, mesmo padrão de acesso
-- das demais tabelas do app (authenticated tem acesso completo).
alter table public.sdr_config enable row level security;
alter table public.sdr_lembretes enable row level security;
alter table public.sdr_conversas enable row level security;
alter table public.sdr_mensagens enable row level security;

drop policy if exists sdr_config_all on public.sdr_config;
create policy sdr_config_all on public.sdr_config for all to authenticated using (true) with check (true);

drop policy if exists sdr_lembretes_all on public.sdr_lembretes;
create policy sdr_lembretes_all on public.sdr_lembretes for all to authenticated using (true) with check (true);

drop policy if exists sdr_conversas_all on public.sdr_conversas;
create policy sdr_conversas_all on public.sdr_conversas for all to authenticated using (true) with check (true);

drop policy if exists sdr_mensagens_all on public.sdr_mensagens;
create policy sdr_mensagens_all on public.sdr_mensagens for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.sdr_config, public.sdr_lembretes, public.sdr_conversas, public.sdr_mensagens to authenticated;
grant usage, select on all sequences in schema public to authenticated;
