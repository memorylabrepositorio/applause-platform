import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";

const MODULES = [
  { to: "/vendas", label: "Painel de Vendas", icon: "💰", desc: "Cruzamento de vendas × agenda, vendedores e estúdios." },
  { to: "/checklist", label: "Checklist de Solenidade", icon: "📋", desc: "Preenchimento por evento — cerimônia, materiais e produção." },
  { to: "/atendimento", label: "CRM de Atendimento", icon: "🤝", desc: "Alunos por contrato, agendados/atendidos e follow-up." },
  { to: "/sdr", label: "SDR (Agente de IA)", icon: "🤖", desc: "Qualificação e primeiro contato automatizado." },
  { to: "/financeiro", label: "Financeiro (Contas a Receber)", icon: "💵", desc: "Parcelas a receber, inadimplência e cobrança." },
  { to: "/producao", label: "Produção (Itens Vendidos)", icon: "🖼️", desc: "Status de produção dos itens vendidos." },
  { to: "/p4f", label: "P4F / Sessão Estúdio", icon: "📸", desc: "Visão filtrada por unidade — Porto Alegre, Caxias, Novo Hamburgo." },
  { to: "/contas-pagar", label: "Contas a Pagar", icon: "🧾", desc: "Orçamento e contas a pagar da operação." },
  { to: "/lucro", label: "Lucro por Contrato", icon: "📈", desc: "Margem por contrato — receita menos custos." },
];

export default function Dashboard() {
  const { org } = useAuth();

  return (
    <Layout>
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Visão geral</h1>
        <p className="text-sm text-ink-400">{org?.name ?? "Organização"} · escolha um painel</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="rounded-lg border border-ink-700 bg-ink-850 p-4 shadow-sm transition hover:border-brand-600 hover:shadow-brand-900/20"
          >
            <span className="mb-2 block text-2xl">{m.icon}</span>
            <p className="font-medium text-ink-50">{m.label}</p>
            <p className="mt-1 text-xs text-ink-400">{m.desc}</p>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
