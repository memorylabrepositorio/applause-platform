import { Link } from "react-router-dom";
import {
  Wallet,
  ClipboardList,
  Handshake,
  Bot,
  Landmark,
  GalleryHorizontalEnd,
  Camera,
  Receipt,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";

const MODULES: { to: string; label: string; icon: LucideIcon; desc: string }[] = [
  { to: "/vendas", label: "Painel de Vendas", icon: Wallet, desc: "Cruzamento de vendas × agenda, vendedores e estúdios." },
  { to: "/checklist", label: "Checklist de Solenidade", icon: ClipboardList, desc: "Preenchimento por evento — cerimônia, materiais e produção." },
  { to: "/atendimento", label: "CRM de Atendimento", icon: Handshake, desc: "Alunos por contrato, agendados/atendidos e follow-up." },
  { to: "/sdr", label: "SDR (Agente de IA)", icon: Bot, desc: "Qualificação e primeiro contato automatizado." },
  { to: "/financeiro", label: "Financeiro (Contas a Receber)", icon: Landmark, desc: "Parcelas a receber, inadimplência e cobrança." },
  { to: "/producao", label: "Produção (Itens Vendidos)", icon: GalleryHorizontalEnd, desc: "Status de produção dos itens vendidos." },
  { to: "/p4f", label: "P4F / Sessão Estúdio", icon: Camera, desc: "Visão filtrada por unidade — Porto Alegre, Caxias, Novo Hamburgo." },
  { to: "/contas-pagar", label: "Contas a Pagar", icon: Receipt, desc: "Orçamento e contas a pagar da operação." },
  { to: "/lucro", label: "Lucro por Contrato", icon: TrendingUp, desc: "Margem por contrato — receita menos custos." },
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
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-xl border border-ink-700 bg-ink-850 p-4 transition-all duration-150 hover:border-brand-600/60 hover:shadow-[0_16px_40px_-16px] hover:shadow-brand-900/40"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600/20 to-brand-600/5 text-brand-400 transition-transform duration-150 group-hover:scale-105 group-hover:text-brand-300">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <p className="font-medium text-ink-50">{m.label}</p>
              <p className="mt-1 text-xs text-ink-400">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </Layout>
  );
}
