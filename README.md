# applause-platform

Sucessor do [sistema-applause](https://github.com/memorylabrepositorio/sistema-applause)
(que continua no ar, intocado, como backup). Mesmo Supabase, stack novo:
Vite + React + TypeScript, pensado desde o início como blocos de lego —
módulos independentes (vendas, checklist, atendimento, SDR/IA...) plugados
numa fundação multi-tenant comum.

## Fundação (`core`)

`supabase/migrations/0001_core_schema.sql` cria o schema `core`:
organizações, membros (`memberships`) e papéis por módulo (`roles`). Todo
módulo novo referencia `core.organizations` por `org_id` em vez de
reinventar login/permissão.

Essa primeira migration é **aditiva**: não toca nas tabelas que já existem
em produção (`vendas`, `contratos`, `clientes`, `agenda`, `checklist_eventos`,
`atendimento_notas`, `atendimento_tarefas`). Rodar sem risco.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a anon key do Supabase (Project Settings > API)
npm run dev
```

## Estado atual

- [x] Fundação multi-tenant (`core` schema)
- [x] Login + rota protegida + resolução de organização
- [x] Painel de Vendas
- [x] Checklist de Solenidade
- [x] CRM de Atendimento
- [x] SDR (agente de IA) — Parte A: lembretes automáticos por WhatsApp
- [x] Financeiro (contas a receber — parcelas, cobrança, status de pagamento)
- [x] Produção (status dos itens vendidos, ligando com a planilha da Dani)
- [x] P4F / Sessão Estúdio (view sobre vendas+agenda, sem tabela nova)
- [x] Contas a Pagar (orçamento por contrato/instituição)
- [x] Lucro por Contrato (formatura + PDV − contas a pagar)
- [x] Mapa (página inicial) — constelação dos departamentos e funções, com links pros módulos (`src/lib/mapa/data.ts`)
- [ ] SDR — Parte B: IA conversando de fato com o aluno
- [ ] Import de planilhas (Dani, Nathia, orçamento do Pedro) e automação Pronet
- [ ] Passe de estética geral (design system, tema, etc.)

O bloco Financeiro/Produção/Contas a Pagar (migration `0005`) já nasce
pensado pra, com o tempo, **substituir o Pronet e o SGE**: cada tabela tem
uma coluna `origem` (`manual` | `pronet`) pra não misturar lançamento manual
com importação futura.

Cada módulo entra como uma caixa nova, sem mexer nas outras.
