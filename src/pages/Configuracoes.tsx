import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Palette, Bot, Receipt } from "lucide-react";
import Layout from "@/components/Layout";
import { loadSdrConfig, saveSdrConfig } from "@/lib/sdr/fetch";
import type { SdrCanal, SdrConfig } from "@/lib/sdr/engine";
import { getSecretsStatus, saveSecret, type SecretName, type SecretsStatus } from "@/lib/settings/fetch";
import { loadFinanceiroConfig, saveFinanceiroConfig, testarConexaoAsaas } from "@/lib/financeiro/fetch";
import type { FinanceiroConfig } from "@/lib/financeiro/fetch";
import { useTheme, type Accent, type FontSize, type Density, type ThemePreference } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { falarSaudacao, listarVozes, primeiroNome, idDaVoz, type Periodo } from "@/lib/greeting";

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

type Tab = "aparencia" | "agente" | "cobrancas";

export default function Configuracoes() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(
    location.hash === "#agente" ? "agente" : location.hash === "#cobrancas" ? "cobrancas" : "aparencia"
  );

  return (
    <Layout>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-ink-400">Aparência da plataforma, agente de SDR e cobrança automática</p>
      </header>

      <div className="mb-4 flex gap-2 border-b border-ink-800">
        <TabButton active={tab === "aparencia"} onClick={() => setTab("aparencia")} icon={Palette}>
          Aparência
        </TabButton>
        <TabButton active={tab === "agente"} onClick={() => setTab("agente")} icon={Bot}>
          Agente de IA (SDR)
        </TabButton>
        <TabButton active={tab === "cobrancas"} onClick={() => setTab("cobrancas")} icon={Receipt}>
          Cobranças (Asaas)
        </TabButton>
      </div>

      {tab === "aparencia" ? <AparenciaTab /> : tab === "agente" ? <AgenteTab /> : <CobrancasTab />}
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
    saudacaoAudio,
    setSaudacaoAudio,
    apelido,
    setApelido,
    saudacaoTextos,
    setSaudacaoTexto,
    saudacaoVozId,
    setSaudacaoVozId,
  } = useTheme();
  const { session } = useAuth();
  const [testando, setTestando] = useState<Periodo | null>(null);
  const [testandoVoz, setTestandoVoz] = useState(false);
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([]);
  const nomePadrao = primeiroNome(session) ?? "";
  const nomeAtual = primeiroNome(session, apelido);

  useEffect(() => {
    if (!saudacaoAudio) return;
    listarVozes().then(setVozes);
  }, [saudacaoAudio]);

  async function testar(periodo: Periodo) {
    setTestando(periodo);
    await falarSaudacao(nomeAtual, saudacaoTextos[periodo], saudacaoVozId);
    setTestando(null);
  }

  const PERIODOS: { id: Periodo; label: string }[] = [
    { id: "manha", label: "Manhã (antes das 12h)" },
    { id: "tarde", label: "Tarde (12h–18h)" },
    { id: "noite", label: "Noite (depois das 18h)" },
  ];

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
          <option value="/">Mapa (padrão)</option>
          <option value="/modulos">Visão geral (cards dos módulos)</option>
          {NAV_ITEMS.map((n) => (
            <option key={n.to} value={n.to}>
              {n.label}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-850 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-ink-100">Saudação por voz ao entrar</p>
            <p className="text-xs text-ink-400">
              "Bom dia/boa tarde/boa noite, {"{nome}"}" falado pelo navegador assim que você loga.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={saudacaoAudio}
            onClick={() => setSaudacaoAudio(!saudacaoAudio)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              saudacaoAudio ? "bg-brand-600" : "bg-ink-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                saudacaoAudio ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {saudacaoAudio && (
          <div className="mt-4 space-y-4 border-t border-ink-800 pt-4">
            <div className="space-y-1">
              <label className="block text-xs text-ink-400">Como você quer ser chamado(a)</label>
              <input
                type="text"
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder={nomePadrao || "seu nome ou apelido"}
                maxLength={40}
                className="w-full max-w-xs rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm text-ink-50"
              />
              <p className="text-[11px] text-ink-500">
                Em branco, usa {nomePadrao ? `"${nomePadrao}"` : "o nome do seu login"}. Fica salvo na sua conta —
                vale em qualquer computador.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-ink-400">Voz</label>
              <div className="flex items-center gap-2">
                <select
                  value={saudacaoVozId}
                  onChange={(e) => setSaudacaoVozId(e.target.value)}
                  className="w-full max-w-sm rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm text-ink-50"
                >
                  <option value="">Automática (melhor voz em pt-BR disponível)</option>
                  {vozes.map((v) => (
                    <option key={idDaVoz(v)} value={idDaVoz(v)}>
                      {v.name} — {v.lang}
                      {v.localService ? "" : " (online)"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={testandoVoz}
                  onClick={async () => {
                    setTestandoVoz(true);
                    await falarSaudacao(null, "Olá! Essa é a voz que vai te dar bom dia por aqui.", saudacaoVozId);
                    setTestandoVoz(false);
                  }}
                  title="Ouvir só a voz escolhida, com uma frase de exemplo"
                  className="shrink-0 rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:border-ink-500 disabled:opacity-50"
                >
                  {testandoVoz ? "Falando…" : "Testar voz"}
                </button>
              </div>
              <p className="text-[11px] text-ink-500">
                {vozes.length > 0
                  ? `${vozes.length} voz(es) disponível(is) neste navegador. A lista varia por computador/sistema. Troque a voz aqui em cima e clique "Testar voz" pra ouvir cada uma antes de escolher.`
                  : "Carregando vozes do navegador… se não aparecer nenhuma, esse navegador não expõe vozes em português."}
              </p>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-ink-400">Mensagem por período do dia</label>
                <p className="text-[11px] text-ink-500">
                  Use {"{nome}"} onde quiser inserir o nome/apelido escolhido acima.
                </p>
              </div>
              {PERIODOS.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[11px] text-ink-500">{p.label}</label>
                    <input
                      type="text"
                      value={saudacaoTextos[p.id]}
                      onChange={(e) => setSaudacaoTexto(p.id, e.target.value)}
                      maxLength={120}
                      className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm text-ink-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testando === p.id}
                    onClick={() => testar(p.id)}
                    title="Testar esta mensagem"
                    className="mt-4 shrink-0 rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 transition hover:border-ink-500 disabled:opacity-50"
                  >
                    {testando === p.id ? "Falando…" : "Testar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <button
        onClick={() => navigate("/")}
        className="text-sm text-ink-400 transition hover:text-ink-100"
      >
        ← Voltar pra página inicial
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

// ---------------------------------------------------------------------
// Cobranças (Asaas) — ambiente, chave da API, token do webhook e teste de
// conexão. Gera a cobrança de PIX/boleto direto de uma parcela em
// Financeiro; aqui só fica a configuração da integração.
// ---------------------------------------------------------------------
function CobrancasTab() {
  const [config, setConfig] = useState<FinanceiroConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secretsStatus, setSecretsStatus] = useState<SecretsStatus | null>(null);
  const [secretsError, setSecretsError] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);
  const [testeMsg, setTesteMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const webhookUrl = (() => {
    try {
      const base = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      return base ? `${base}/functions/v1/fin-asaas-webhook` : "";
    } catch {
      return "";
    }
  })();

  async function refresh() {
    try {
      setConfig(await loadFinanceiroConfig());
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

  async function patch(p: Partial<FinanceiroConfig>) {
    if (!config) return;
    setConfig({ ...config, ...p });
    try {
      await saveFinanceiroConfig(p);
    } catch (e: unknown) {
      alert("Não foi possível salvar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleTestar() {
    setTestando(true);
    setTesteMsg(null);
    const r = await testarConexaoAsaas();
    setTesteMsg(
      r.ok
        ? { ok: true, texto: `Conectado ✓ (saldo atual: ${r.balance?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"})` }
        : { ok: false, texto: r.error || "Falha ao testar conexão" }
    );
    setTestando(false);
  }

  function gerarToken() {
    const token = crypto.randomUUID().replace(/-/g, "");
    navigator.clipboard.writeText(token).catch(() => {});
    return token;
  }

  if (error) {
    return <p className="text-red-400">Não foi possível carregar: {error}</p>;
  }

  if (!config) {
    return <p className="text-ink-400">Carregando configurações…</p>;
  }

  return (
    <div className="max-w-2xl">
      <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-1 text-sm font-medium text-ink-100">Sobre a cobrança automática</p>
        <p className="text-xs text-ink-400">
          Com isso ativo, o Financeiro pode gerar um link de PIX ou boleto direto de uma parcela em aberto — quando o
          aluno pagar, o status é atualizado sozinho, sem precisar marcar "pago" na mão.
        </p>
      </section>

      <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-1 text-sm font-medium text-ink-100">Ambiente</p>
        <p className="mb-3 text-xs text-ink-400">
          Use "Sandbox" pra testar sem gerar cobrança real. Troque pra "Produção" só quando já tiver uma conta Asaas
          verificada.
        </p>
        <div className="flex gap-2">
          {(["sandbox", "producao"] as const).map((a) => (
            <button
              key={a}
              onClick={() => patch({ asaas_ambiente: a })}
              className={`rounded-md border px-3.5 py-1.5 text-sm transition ${
                config.asaas_ambiente === a
                  ? "border-brand-600 bg-brand-950 text-brand-300"
                  : "border-ink-600 text-ink-300 hover:text-ink-50"
              }`}
            >
              {a === "sandbox" ? "Sandbox (teste)" : "Produção"}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-1 text-sm font-medium text-ink-100">Chave da API</p>
        <p className="mb-2 text-xs text-ink-400">
          Encontrada em Asaas → Integrações → API. Use a chave do mesmo ambiente escolhido acima.
        </p>
        <SecretField
          label="Chave da API (Access Token)"
          secretName="ASAAS_API_KEY"
          configurado={secretsStatus?.ASAAS_API_KEY}
          erro={secretsError}
          onSaved={refresh}
        />
        <div className="mt-3 flex items-center gap-3 border-t border-ink-800 pt-3">
          <button
            onClick={handleTestar}
            disabled={testando}
            className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-200 hover:border-ink-500 disabled:opacity-50"
          >
            {testando ? "Testando…" : "Testar conexão"}
          </button>
          {testeMsg && (
            <p className={`text-xs ${testeMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{testeMsg.texto}</p>
          )}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-1 text-sm font-medium text-ink-100">Webhook (atualização automática de status)</p>
        <p className="mb-2 text-xs text-ink-400">
          Cole essa URL em Asaas → Integrações → Webhooks, marcando os eventos de pagamento. O token abaixo vai no
          campo "Token de autenticação" da mesma tela — os dois lados precisam ter o mesmo valor.
        </p>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-ink-400">URL do webhook</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={webhookUrl || "defina VITE_SUPABASE_URL pra ver a URL"}
              className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm text-ink-300"
            />
            <button
              onClick={() => webhookUrl && navigator.clipboard.writeText(webhookUrl)}
              className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-200 hover:border-ink-500"
            >
              Copiar
            </button>
          </div>
        </div>
        <SecretFieldComToken
          configurado={secretsStatus?.ASAAS_WEBHOOK_TOKEN}
          erro={secretsError}
          onSaved={refresh}
          gerarToken={gerarToken}
        />
      </section>
    </div>
  );
}

// campo de token com botão "gerar" — cria um valor aleatório, copia pra área
// de transferência (pra colar no Asaas) e já deixa preenchido pra salvar
function SecretFieldComToken({
  configurado,
  erro,
  onSaved,
  gerarToken,
}: {
  configurado?: boolean;
  erro?: string | null;
  onSaved: () => void;
  gerarToken: () => string;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave(v: string) {
    if (!v.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await saveSecret("ASAAS_WEBHOOK_TOKEN", v.trim());
      setValue("");
      setMsg("Salvo com segurança ✓ — copiado pra área de transferência, cole no Asaas");
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
        <label className="text-xs text-ink-400">Token do webhook</label>
        {configurado === true && (
          <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
            configurado ✓
          </span>
        )}
        {configurado === false && (
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-xs text-ink-400">
            não configurado
          </span>
        )}
      </div>
      {erro && (
        <p className="mb-2 max-w-xl text-xs text-amber-400">
          Não consegui checar o status ({erro}) — você ainda pode gerar e salvar o token abaixo.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={configurado ? "•••••••• (deixe em branco pra manter o atual)" : "Clique em Gerar →"}
          className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 font-mono text-sm"
        />
        <button
          onClick={() => setValue(gerarToken())}
          className="rounded-md border border-ink-600 px-2.5 py-1 text-sm text-ink-200 hover:border-ink-500"
        >
          Gerar
        </button>
        <button
          onClick={() => handleSave(value)}
          disabled={saving || !value.trim()}
          className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-ink-400">{msg}</p>}
    </div>
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
  secretName: SecretName;
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
