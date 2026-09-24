import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Palette, Bot } from "lucide-react";
import Layout from "@/components/Layout";
import { loadSdrConfig, saveSdrConfig } from "@/lib/sdr/fetch";
import type { SdrCanal, SdrConfig } from "@/lib/sdr/engine";
import { getSecretsStatus, saveSecret, type SecretsStatus } from "@/lib/settings/fetch";
import { useTheme, type Accent, type FontSize, type Density, type ThemePreference } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { to: "/vendas", label: "Vendas" },
  { to: "/checklist", label: "Checklist" },
  { to: "/atendimento", label: "Atendimento" },
  { to: "/sdr", label: "SDR (IA)" },
  { to: "/financeiro", label: "Financeiro" },
  { to: "/producao", label: "Produção" },
  { to: "/p4f", label: "P4F / Estúdio" },
  { to: "/contas-pagar", label: "Contas a pagar" },
  { to: "/lucro", label: "Lucro por contrato" },
];

type Tab = "aparencia" | "agente";

export default function Configuracoes() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(location.hash === "#agente" ? "agente" : "aparencia");

  return (
    <Layout>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-ink-400">Aparência da plataforma e comportamento do agente de SDR</p>
      </header>

      <div className="mb-4 flex gap-2 border-b border-ink-800">
        <TabButton active={tab === "aparencia"} onClick={() => setTab("aparencia")} icon={Palette}>
          Aparência
        </TabButton>
        <TabButton active={tab === "agente"} onClick={() => setTab("agente")} icon={Bot}>
          Agente de IA (SDR)
        </TabButton>
      </div>

      {tab === "aparencia" ? <AparenciaTab /> : <AgenteTab />}
    </Layout>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm transition ${
        active ? "border-brand-500 text-ink-50" : "border-transparent text-ink-400 hover:text-ink-100"
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Aparência — tema, cor de destaque, tamanho de fonte, densidade e a
// página inicial padrão, tudo salvo por usuário (localStorage)
// ---------------------------------------------------------------------
function AparenciaTab() {
  const navigate = useNavigate();
  const {
    themePreference,
    setThemePreference,
    accent,
    setAccent,
    fontSize,
    setFontSize,
    density,
    setDensity,
    defaultRoute,
    setDefaultRoute,
  } = useTheme();

  const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
    { id: "dark", label: "Escuro" },
    { id: "light", label: "Claro" },
    { id: "auto", label: "Automático" },
  ];
  const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
    { id: "blue", label: "Azul", swatch: "#0464b0" },
    { id: "violet", label: "Violeta", swatch: "#4a3aa7" },
    { id: "green", label: "Verde", swatch: "#1baf7a" },
    { id: "orange", label: "Laranja", swatch: "#eb6834" },
  ];
  const FONT_OPTIONS: { id: FontSize; label: string; sample: string }[] = [
    { id: "compact", label: "Compacto", sample: "text-xs" },
    { id: "normal", label: "Normal", sample: "text-sm" },
    { id: "comfortable", label: "Confortável", sample: "text-base" },
  ];
  const DENSITY_OPTIONS: { id: Density; label: string; desc: string }[] = [
    { id: "comfortable", label: "Confortável", desc: "Mais espaço entre linhas e cards (padrão)" },
    { id: "compact", label: "Compacta", desc: "Menos espaçamento — mais linhas visíveis por tela" },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <p className="mb-1 text-sm font-medium text-ink-100">Tema</p>
        <p className="mb-3 text-xs text-ink-400">
          "Automático" segue a preferência de claro/escuro do seu sistema operacional.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemePreference(t.id)}
              className={`rounded-md border px-3.5 py-1.5 text-sm transition ${
                themePreference === t.id
                  ? "border-brand-600 bg-brand-950 text-brand-300"
                  : "border-ink-600 text-ink-300 hover:text-ink-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <p className="mb-1 text-sm font-medium text-ink-100">Cor de destaque</p>
        <p className="mb-3 text-xs text-ink-400">Usada em botões, links ativos e gráficos.</p>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              title={a.label}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`h-9 w-9 rounded-full border-2 transition ${
                  accent === a.id ? "border-ink-50 scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ background: a.swatch }}
              />
              <span className="text-xs text-ink-400">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <p className="mb-1 text-sm font-medium text-ink-100">Tamanho da fonte</p>
        <p className="mb-3 text-xs text-ink-400">Ajusta o tamanho de todo o texto da plataforma.</p>
        <div className="flex flex-wrap gap-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFontSize(f.id)}
              className={`rounded-md border px-3.5 py-1.5 transition ${f.sample} ${
                fontSize === f.id
                  ? "border-brand-600 bg-brand-950 text-brand-300"
                  : "border-ink-600 text-ink-300 hover:text-ink-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <p className="mb-1 text-sm font-medium text-ink-100">Densidade das tabelas</p>
        <p className="mb-3 text-xs text-ink-400">Controla o espaçamento das linhas em tabelas e cards.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DENSITY_OPTIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDensity(d.id)}
              className={`rounded-md border px-3.5 py-2.5 text-left transition ${
                density === d.id ? "border-brand-600 bg-brand-950/40" : "border-ink-600 hover:border-ink-500"
              }`}
            >
              <p className={`text-sm ${density === d.id ? "text-brand-300" : "text-ink-100"}`}>{d.label}</p>
              <p className="mt-0.5 text-xs text-ink-400">{d.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <p className="mb-1 text-sm font-medium text-ink-100">Página inicial</p>
        <p className="mb-3 text-xs text-ink-400">Qual painel abre primeiro ao entrar na plataforma.</p>
        <select
          value={defaultRoute}
          onChange={(e) => setDefaultRoute(e.target.value)}
          className="w-full max-w-sm rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm"
        >
          <option value="/">Visão geral (Dashboard)</option>
          {NAV_ITEMS.map((n) => (
            <option key={n.to} value={n.to}>
              {n.label}
            </option>
          ))}
        </select>
      </section>

      <button
        onClick={() => navigate("/")}
        className="text-sm text-ink-400 transition hover:text-ink-100"
      >
        ← Voltar pra visão geral
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Agente de IA (SDR) — comportamento e integrações de canal (código
// original desta página, só movido pra dentro de uma aba)
// ---------------------------------------------------------------------
function AgenteTab() {
  const [config, setConfig] = useState<SdrConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secretsStatus, setSecretsStatus] = useState<SecretsStatus | null>(null);
  const [secretsError, setSecretsError] = useState<string | null>(null);

  async function refresh() {
    try {
      setConfig(await loadSdrConfig());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar configuração");
    }
    const { status, error: err } = await getSecretsStatus();
    if (status) setSecretsStatus(status);
    if (err) setSecretsError(err);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function patch(p: Partial<SdrConfig>) {
    if (!config) return;
    setConfig({ ...config, ...p });
    try {
      await saveSdrConfig(p);
    } catch (e: unknown) {
      alert("Não foi possível salvar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  if (error) {
    return <p className="text-red-400">Não foi possível carregar: {error}</p>;
  }

  if (!config) {
    return <p className="text-ink-400">Carregando configurações…</p>;
  }

  return (
    <>
      {/* comportamento do agente */}
      <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-1 text-sm font-medium text-ink-100">Comportamento do agente</p>
        <p className="mb-4 text-xs text-ink-400">
          Isso já vale hoje pra assinatura das mensagens, e é a base do prompt quando a IA passar a conversar de
          verdade (próxima etapa do SDR).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ink-400">Nome do agente</label>
            <input
              defaultValue={config.nome_agente}
              onBlur={(e) => patch({ nome_agente: e.target.value })}
              className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Tom de voz</label>
            <select
              value={config.tom_agente}
              onChange={(e) => patch({ tom_agente: e.target.value })}
              className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
            >
              <option value="cordial e objetivo">Cordial e objetivo</option>
              <option value="descontraído e próximo">Descontraído e próximo</option>
              <option value="formal">Formal</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-ink-400">
            Prompt de comportamento (instruções gerais de como o agente deve agir)
          </label>
          <textarea
            defaultValue={config.prompt_comportamento}
            onBlur={(e) => patch({ prompt_comportamento: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
          />
        </div>
      </section>

      {/* integração evolution */}
      <IntegracaoCard
        titulo="Evolution API (WhatsApp não-oficial)"
        ativo={config.canal === "evolution"}
        onAtivar={() => patch({ canal: "evolution" as SdrCanal })}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ink-400">URL da instância</label>
            <input
              defaultValue={config.evolution_base_url || ""}
              onBlur={(e) => patch({ evolution_base_url: e.target.value })}
              placeholder="https://sua-evolution-api.com"
              className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Nome da instância</label>
            <input
              defaultValue={config.evolution_instance || ""}
              onBlur={(e) => patch({ evolution_instance: e.target.value })}
              placeholder="applause-whatsapp"
              className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
            />
          </div>
        </div>
        <SecretField
          label="API Key"
          secretName="EVOLUTION_API_KEY"
          configurado={secretsStatus?.EVOLUTION_API_KEY}
          erro={secretsError}
          onSaved={refresh}
        />
      </IntegracaoCard>

      {/* integração meta */}
      <IntegracaoCard
        titulo="API oficial da Meta (WhatsApp Business)"
        ativo={config.canal === "meta"}
        onAtivar={() => patch({ canal: "meta" as SdrCanal })}
      >
        <div>
          <label className="mb-1 block text-xs text-ink-400">Phone Number ID</label>
          <input
            defaultValue={config.meta_phone_number_id || ""}
            onBlur={(e) => patch({ meta_phone_number_id: e.target.value })}
            placeholder="123456789012345"
            className="w-full max-w-sm rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
          />
        </div>
        <SecretField
          label="Access Token"
          secretName="META_ACCESS_TOKEN"
          configurado={secretsStatus?.META_ACCESS_TOKEN}
          erro={secretsError}
          onSaved={refresh}
        />
      </IntegracaoCard>
    </>
  );
}

function IntegracaoCard({
  titulo,
  ativo,
  onAtivar,
  children,
}: {
  titulo: string;
  ativo: boolean;
  onAtivar: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">{titulo}</p>
        <button
          onClick={onAtivar}
          className={`rounded-full border px-3 py-1 text-xs ${
            ativo ? "border-emerald-700 bg-emerald-950 text-emerald-300" : "border-ink-600 text-ink-300"
          }`}
        >
          {ativo ? "✓ Canal ativo" : "Usar este canal"}
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SecretField({
  label,
  secretName,
  configurado,
  erro,
  onSaved,
}: {
  label: string;
  secretName: "EVOLUTION_API_KEY" | "META_ACCESS_TOKEN";
  configurado?: boolean;
  erro?: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await saveSecret(secretName, value.trim());
      setValue("");
      setMsg("Salvo com segurança ✓");
      onSaved();
    } catch (e: unknown) {
      setMsg("Erro: " + (e instanceof Error ? e.message : "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 border-t border-ink-800 pt-3">
      <div className="mb-1 flex items-center gap-2">
        <label className="text-xs text-ink-400">{label}</label>
        {configurado === true && (
          <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
            configurada ✓
          </span>
        )}
        {configurado === false && (
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-xs text-ink-400">
            não configurada
          </span>
        )}
      </div>
      {erro && (
        <p className="mb-2 max-w-xl text-xs text-amber-400">
          Não consegui checar o status ({erro}) — provavelmente falta o bootstrap da Management API (veja as
          instruções de deploy). Você ainda pode salvar a chave abaixo.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={configurado ? "•••••••• (deixe em branco pra manter a atual)" : "Cole a chave aqui"}
          className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          Salvar chave
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-ink-400">{msg}</p>}
      <p className="mt-1 text-xs text-ink-500">
        A chave nunca fica salva no banco — vira um secret do projeto, só a Edge Function lê o valor.
      </p>
    </div>
  );
}
