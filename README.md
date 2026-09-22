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
reinventar login/permissão — o mesmo padrão usado no projeto do SDR
(schema `core` central + um schema por solução).

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
- [ ] Painel de Vendas
- [ ] Checklist de Solenidade
- [ ] CRM de Atendimento
- [ ] SDR (agente de IA, aproveitando o projeto arkom-sdr)

Cada módulo entra como uma caixa nova, sem mexer nas outras.
