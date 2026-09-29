import { useEffect, useMemo, useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { loadFreelancersStaffData, type FreelancersStaffData } from "@/lib/freelancers/fetch";
import { atualizarStatusFreelancer, atualizarStatusVaga, criarVaga, decidirCandidatura } from "@/lib/freelancers/actions";
import {
  CANDIDATURA_STATUS_LABEL,
  VAGA_STATUS_LABEL,
  aprovadosPorVaga,
  fmtDateBR,
  fmtMoneyBR,
  type CandidaturaStatus,
  type VagaStatus,
} from "@/lib/freelancers/engine";

type Aba = "vagas" | "candidaturas" | "freelancers";

export default function EstudioFreelancers() {
  const [data, setData] = useState<FreelancersStaffData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("candidaturas");
  const [busyId, setBusyId] = useState<number | string | null>(null);

  async function refresh() {
    try {
      const d = await loadFreelancersStaffData();
      setData(d);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro ao carregar");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const freelancerNome = useMemo(() => {
    const map: Record<string, string> = {};
    data?.freelancers.forEach((f) => (map[f.user_id] = f.nome_completo));
    return map;
  }, [data]);

  const vagaData = useMemo(() => {
    const map: Record<number, string> = {};
    data?.vagas.forEach((v) => (map[v.id] = fmtDateBR(v.data)));
    return map;
  }, [data]);

  const aprovados = useMemo(() => (data ? aprovadosPorVaga(data.candidaturas) : {}), [data]);

  async function handleDecidir(id: number, status: "aprovado" | "recusado") {
    setBusyId(id);
    try {
      await decidirCandidatura(id, status);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusVaga(id: number, status: VagaStatus) {
    setBusyId(id);
    try {
      await atualizarStatusVaga(id, status);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusFreelancer(userId: string, status: "ativo" | "inativo") {
    setBusyId(userId);
    try {
      await atualizarStatusFreelancer(userId, status);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
    return (
      <Layout>
        <p className="text-red-400">Não foi possível carregar: {error}</p>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <p className="text-ink-300">Carregando freelancers…</p>
      </Layout>
    );
  }

  const pendentes = data.candidaturas.filter((c) => c.status === "pendente");

  return (
    <Layout>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Freelancers — Estúdio</h1>
        <p className="text-sm text-ink-400">
          {data.freelancers.length} cadastrados · {data.vagas.filter((v) => v.status === "aberta").length} vagas abertas ·{" "}
          {pendentes.length} candidatura(s) pendente(s)
        </p>
      </header>

      <div className="mb-4 flex gap-1 border-b border-ink-800">
        {(
          [
            ["candidaturas", `Candidaturas (${pendentes.length})`],
            ["vagas", "Vagas"],
            ["freelancers", "Freelancers"],
          ] as [Aba, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`rounded-t-md px-3 py-2 text-sm ${
              aba === id ? "border-b-2 border-brand-500 text-ink-50" : "text-ink-400 hover:text-ink-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {aba === "candidaturas" && (
        <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>
                <th className="px-2.5 py-1.5">Freelancer</th>
                <th className="px-2.5 py-1.5">Vaga</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {!data.candidaturas.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-400">
                    Nenhuma candidatura ainda.
                  </td>
                </tr>
              )}
              {data.candidaturas.map((c) => (
                <tr key={c.id} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                  <td className="px-2.5 py-1.5">{freelancerNome[c.freelancer_id] || c.freelancer_id}</td>
                  <td className="px-2.5 py-1.5 text-ink-300">{vagaData[c.vaga_id] || `#${c.vaga_id}`}</td>
                  <td className="px-2.5 py-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${candidaturaClass(c.status)}`}>
                      {CANDIDATURA_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    {c.status === "pendente" ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleDecidir(c.id, "aprovado")}
                          disabled={busyId === c.id}
                          className="rounded-md border border-emerald-800 bg-emerald-950 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-900 disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleDecidir(c.id, "recusado")}
                          disabled={busyId === c.id}
                          className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-xs text-red-300 hover:bg-red-900 disabled:opacity-50"
                        >
                          Recusar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "vagas" && (
        <div className="space-y-4">
          <NovaVagaForm onCriada={refresh} />
          <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-800 text-xs text-ink-400">
                <tr>
                  <th className="px-2.5 py-1.5">Data</th>
                  <th className="px-2.5 py-1.5">Local</th>
                  <th className="px-2.5 py-1.5">Vagas</th>
                  <th className="px-2.5 py-1.5">Status</th>
                  <th className="px-2.5 py-1.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.vagas.map((v) => (
                  <tr key={v.id} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                    <td className="px-2.5 py-1.5">{fmtDateBR(v.data)}</td>
                    <td className="px-2.5 py-1.5 text-ink-300">
                      {v.instituicao || "—"} {v.valor_diaria ? `· ${fmtMoneyBR(v.valor_diaria)}` : ""}
                    </td>
                    <td className="px-2.5 py-1.5 text-ink-300">
                      {aprovados[v.id] || 0} / {v.qtd_necessaria}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${vagaClass(v.status)}`}>{VAGA_STATUS_LABEL[v.status]}</span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      {v.status === "aberta" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleStatusVaga(v.id, "fechada")}
                            disabled={busyId === v.id}
                            className="rounded-md border border-ink-600 px-2 py-1 text-xs text-ink-300 hover:text-ink-50 disabled:opacity-50"
                          >
                            Fechar
                          </button>
                          <button
                            onClick={() => handleStatusVaga(v.id, "cancelada")}
                            disabled={busyId === v.id}
                            className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === "freelancers" && (
        <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>
                <th className="px-2.5 py-1.5">Nome</th>
                <th className="px-2.5 py-1.5">Contato</th>
                <th className="px-2.5 py-1.5">Cidade</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.freelancers.map((f) => (
                <tr key={f.user_id} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                  <td className="px-2.5 py-1.5">{f.nome_completo}</td>
                  <td className="px-2.5 py-1.5 text-ink-300">
                    {f.telefone || "—"} {f.email ? `· ${f.email}` : ""}
                  </td>
                  <td className="px-2.5 py-1.5 text-ink-300">{f.cidade || "—"}</td>
                  <td className="px-2.5 py-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        f.status === "ativo" ? "border-emerald-800 bg-emerald-950 text-emerald-300" : "border-ink-700 bg-ink-800 text-ink-400"
                      }`}
                    >
                      {f.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <button
                      onClick={() => handleStatusFreelancer(f.user_id, f.status === "ativo" ? "inativo" : "ativo")}
                      disabled={busyId === f.user_id}
                      className="rounded-md border border-ink-600 px-2 py-1 text-xs text-ink-300 hover:text-ink-50 disabled:opacity-50"
                    >
                      {f.status === "ativo" ? "Marcar inativo" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

function NovaVagaForm({ onCriada }: { onCriada: () => void }) {
  const [data, setData] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [qtdNecessaria, setQtdNecessaria] = useState("1");
  const [valorDiaria, setValorDiaria] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await criarVaga({
        data,
        horarioInicio: horarioInicio || undefined,
        horarioFim: horarioFim || undefined,
        instituicao: instituicao || undefined,
        tipoEvento: tipoEvento || undefined,
        qtdNecessaria: Number(qtdNecessaria) || 1,
        valorDiaria: valorDiaria ? Number(valorDiaria) : undefined,
      });
      setData("");
      setHorarioInicio("");
      setHorarioFim("");
      setInstituicao("");
      setTipoEvento("");
      setQtdNecessaria("1");
      setValorDiaria("");
      setAberto(false);
      onCriada();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "erro ao criar vaga");
    } finally {
      setBusy(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
      >
        + Nova vaga
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 rounded-lg border border-ink-800 bg-ink-850 p-3 sm:grid-cols-4">
      <Campo label="Data" type="date" value={data} onChange={setData} required />
      <Campo label="Início" type="time" value={horarioInicio} onChange={setHorarioInicio} />
      <Campo label="Fim" type="time" value={horarioFim} onChange={setHorarioFim} />
      <Campo label="Vagas necessárias" type="number" value={qtdNecessaria} onChange={setQtdNecessaria} required />
      <Campo label="Instituição / local" value={instituicao} onChange={setInstituicao} className="col-span-2" />
      <Campo label="Tipo de evento" value={tipoEvento} onChange={setTipoEvento} />
      <Campo label="Valor da diária (R$)" type="number" value={valorDiaria} onChange={setValorDiaria} />
      <div className="col-span-full flex items-center gap-2">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? "Criando…" : "Criar vaga"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-ink-400 hover:text-ink-100">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs text-ink-400">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-sm text-ink-50"
      />
    </div>
  );
}

function candidaturaClass(status: CandidaturaStatus): string {
  switch (status) {
    case "pendente":
      return "border-ink-600 bg-ink-800 text-ink-100";
    case "aprovado":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
    case "recusado":
      return "border-red-800 bg-red-950 text-red-300";
    case "cancelado":
      return "border-ink-700 bg-ink-800 text-ink-400";
  }
}

function vagaClass(status: VagaStatus): string {
  switch (status) {
    case "aberta":
      return "border-brand-800 bg-brand-950 text-brand-300";
    case "fechada":
      return "border-ink-700 bg-ink-800 text-ink-300";
    case "cancelada":
      return "border-red-800 bg-red-950 text-red-300";
  }
}
