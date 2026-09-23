import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BackLink from "@/components/BackLink";
import { loadSdrConfig, saveSdrConfig } from "@/lib/sdr/fetch";
import type { SdrCanal, SdrConfig } from "@/lib/sdr/engine";
import { getSecretsStatus, saveSecret, type SecretsStatus } from "@/lib/settings/fetch";

export default function Configuracoes() {
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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar: {error}</p>
        <Link to="/sdr" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando configurações…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configurações</h1>
          <p className="text-sm text-ink-400">Comportamento do agente e integrações da plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/sdr" className="text-sm text-ink-300 hover:text-ink-50">
            ← Voltar pro SDR
          </Link>
          <BackLink />
        </div>
      </header>

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
