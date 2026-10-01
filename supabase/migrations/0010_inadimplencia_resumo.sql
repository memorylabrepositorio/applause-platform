-- inadimplencia_resumo — relatório "RESUMO POR CONTRATO-CLIENTE" do Pronet.
--
-- É um relatório de FOTO (snapshot): por contrato/cliente, mostra contratado,
-- faturado, pendente, quitado, a vencer, inadimplente e % inadimplente —
-- agregado, sem parcela individual (sem cliente_codigo numérico nem
-- vencimento por parcela), por isso não encaixa em financeiro_parcelas.
--
-- Cada import guarda uma nova "foto" (referencia_em = data do relatório)
-- em vez de sobrescrever a anterior, preservando histórico de inadimplência
-- ao longo do tempo. contrato_nro_controle dá o link com financeiro_parcelas/
-- producao_itens/contas_pagar quando precisar cruzar dados.
create table if not exists public.inadimplencia_resumo (
  id bigint generated always as identity primary key,
  contrato_nro_controle text not null,
  cliente_nome text not null,
  -- um mesmo cliente pode ter mais de um lançamento dentro do mesmo
  -- contrato (ex: mensalidade + taxa) — o relatório não os distingue por
  -- nome, só pela ordem em que aparecem; item_seq preserva essa ordem
  -- (1, 2, 3...) pra não perder nenhum item quando isso acontece.
  item_seq int not null default 1,
  valor_contratado numeric(12,2) not null default 0,
  valor_faturado numeric(12,2) not null default 0,
  valor_pendente numeric(12,2) not null default 0,
  valor_quitado numeric(12,2) not null default 0,
  valor_a_vencer numeric(12,2) not null default 0,
  valor_inadimplente numeric(12,2) not null default 0,
  percentual_inadimplente numeric(5,2) not null default 0,
  referencia_em date not null default current_date,
  origem text not null default 'pronet' check (origem in ('manual', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists inadimplencia_resumo_contrato_idx on public.inadimplencia_resumo (contrato_nro_controle);
create index if not exists inadimplencia_resumo_referencia_idx on public.inadimplencia_resumo (referencia_em);
-- evita duplicar a mesma linha na mesma foto, se o import rodar 2x por engano
-- (inclui item_seq pra não colidir quando o mesmo cliente tem mais de um
-- lançamento no mesmo contrato — ver comentário da coluna acima)
create unique index if not exists inadimplencia_resumo_unica_por_foto
  on public.inadimplencia_resumo (contrato_nro_controle, cliente_nome, item_seq, referencia_em);

alter table public.inadimplencia_resumo enable row level security;

drop policy if exists inadimplencia_resumo_all on public.inadimplencia_resumo;
create policy inadimplencia_resumo_all on public.inadimplencia_resumo for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.inadimplencia_resumo to authenticated;
