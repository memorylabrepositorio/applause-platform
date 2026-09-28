-- Base de dados do setor de Edição (convites, vídeos, álbuns).
--
-- Hoje a entrada é manual: a gestora digita na guia "2026" da planilha
-- "CONTROLE EDICAO ESTUDIO" quando o Pronet acusa uma venda, e depois move
-- a linha entre guias (Tarefas → Álbuns em Aprovação → Em Espera pra
-- Gráfica → Álbuns Aprovados) conforme o álbum avança.
--
-- `cliente_codigo` é nullable de propósito: essa planilha nunca teve o
-- "Código do cliente" do Pronet, só nome+instituição — o cruzamento com
-- `clientes` vai ser tentado por nome+instituição na importação (igual foi
-- feito na P4F), mas fica incompleto até a automação do Pronet virar o
-- ponto único de entrada do cliente no banco (aí sim o código nasce junto
-- com a venda e viaja sozinho pra cá).
--
-- `origem` diferencia dado que veio da migração da planilha antiga
-- ('planilha') do que já nasceu direto no painel ('manual') ou de uma
-- futura automação do Pronet ('pronet').

-- ---------------------------------------------------------------------------
-- producao_edicao — intake/produção do ano corrente (equivalente à guia "2026")
-- ---------------------------------------------------------------------------
create table if not exists public.producao_edicao (
  id bigint generated always as identity primary key,
  cliente_codigo bigint,
  aluno text not null,
  instituicao text,
  curso text,
  observacao text,
  financeiro text,
  estudio text,
  data_sessao date,
  data_lancamento date,
  data_limite date,
  entrada_edicao date,
  saida_edicao date,
  editor text,
  fotolivro text,
  produto text,
  qtdd text,
  link_drive text,
  depoimento text,
  quadro text,
  vendedor text,
  observacoes text,
  origem text not null default 'manual' check (origem in ('manual', 'planilha', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists producao_edicao_cliente_idx on public.producao_edicao (cliente_codigo);
create index if not exists producao_edicao_editor_idx on public.producao_edicao (editor);
create index if not exists producao_edicao_aluno_idx on public.producao_edicao (aluno);

-- ---------------------------------------------------------------------------
-- funil_albuns — workflow de aprovação do álbum (unifica as 4 guias antigas)
-- ---------------------------------------------------------------------------
create table if not exists public.funil_albuns (
  id bigint generated always as identity primary key,
  cliente_codigo bigint,
  producao_edicao_id bigint references public.producao_edicao (id) on delete set null,
  aluno text not null,
  instituicao text,
  curso text,
  local text,
  tamanho_fotolivro text,
  separacao text,
  diagramacao text,
  capa text,
  depoimento text,
  chamada text,
  qr_code text,
  nfc text,
  status text not null default 'tarefas'
    check (status in ('tarefas', 'em_aprovacao', 'em_espera_grafica', 'aprovado')),
  data_recebimento date,
  prazo date,
  observacoes text,
  data_envio_aprovacao date,
  data_retorno_cliente date,
  data_prevista_recebimento date,
  data_envio_pamecolor date,
  data_recebimento_album date,
  data_retirada_cliente date,
  codigo text,
  qtd_fotos_enviadas text,
  origem text not null default 'manual' check (origem in ('manual', 'planilha', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists funil_albuns_cliente_idx on public.funil_albuns (cliente_codigo);
create index if not exists funil_albuns_status_idx on public.funil_albuns (status);
create index if not exists funil_albuns_aluno_idx on public.funil_albuns (aluno);

-- ---------------------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas do app
-- ---------------------------------------------------------------------------
alter table public.producao_edicao enable row level security;
alter table public.funil_albuns enable row level security;

drop policy if exists producao_edicao_all on public.producao_edicao;
create policy producao_edicao_all on public.producao_edicao for all to authenticated using (true) with check (true);

drop policy if exists funil_albuns_all on public.funil_albuns;
create policy funil_albuns_all on public.funil_albuns for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.producao_edicao, public.funil_albuns to authenticated;
grant usage, select on all sequences in schema public to authenticated;
