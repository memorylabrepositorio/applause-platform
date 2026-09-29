import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FreelancerProtectedRoute } from "@/components/FreelancerProtectedRoute";
import FreelancerLayout from "@/components/FreelancerLayout";
import { fetchMinhasCandidaturas, fetchVagasAbertas } from "@/lib/freelancers/fetch";
import { candidatarSe } from "@/lib/freelancers/actions";
import { fmtDateBR, fmtMoneyBR, type CandidaturaFreelancer, type VagaFreelancer } from "@/lib/freelancers/engine";

export default function FreelancerAgenda() {
  return <FreelancerProtectedRoute>{({ perfil }) => <Conteudo freelancerId={perfil.user_id} />}</FreelancerProtectedRoute>;
}

export function Conteudo({ freelancerId }: { freelancerId: string }) {
  const [vagas, setVagas] = useState<VagaFreelancer[] | null>(null);
  const [minhas, setMinhas] = useState<CandidaturaFreelancer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidatandoId, setCandidatandoId] = useState<number | null>(null);

  async function refresh() {
    try {
      const [v, c] = await Promise.all([fetchVagasAbertas(), fetchMinhasCandidaturas(freelancerId)]);
      setVagas(v);
      setMinhas(c);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro ao carregar");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freelancerId]);

  async function handleCandidatar(vagaId: number) {
    setCandidatandoId(vagaId);
    try {
      await candidatarSe(vagaId, freelancerId);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro ao se candidatar");
    } finally {
      setCandidatandoId(null);
    }
  }

  const jaCandidatado = new Set((minhas ?? []).filter((c) => c.status !== "cancelado").map((c) => c.vaga_id));

  return (
    <FreelancerLayout>
      <h1 className="mb-1 text-xl font-semibold">Agenda de vagas</h1>
      <p className="mb-4 text-sm text-ink-400">Datas com sessão precisando de fotógrafo — candidate-se nas que puder atender.</p>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!vagas ? (
        <p className="text-ink-400">Carregando…</p>
      ) : vagas.length === 0 ? (
        <p className="text-ink-400">Nenhuma vaga aberta no momento.</p>
      ) : (
        <div className="space-y-2">
          {vagas.map((v) => {
            const candidatado = jaCandidatado.has(v.id);
            return (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
                <div>
                  <p className="font-medium text-ink-50">
                    {fmtDateBR(v.data)}
                    {v.horario_inicio && ` · ${v.horario_inicio.slice(0, 5)}`}
                    {v.horario_fim && `–${v.horario_fim.slice(0, 5)}`}
                  </p>
                  <p className="text-sm text-ink-300">
                    {v.instituicao || "Local a definir"}
                    {v.tipo_evento && ` · ${v.tipo_evento}`}
                  </p>
                  <p className="text-xs text-ink-400">
                    {v.qtd_necessaria} freelancer(s) · {v.valor_diaria ? fmtMoneyBR(v.valor_diaria) : "valor a combinar"}
                  </p>
                </div>
                <button
                  onClick={() => handleCandidatar(v.id)}
                  disabled={candidatado || candidatandoId === v.id}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    candidatado
                      ? "border border-emerald-800 bg-emerald-950 text-emerald-300"
                      : "bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
                  }`}
                >
                  {candidatado ? "Candidatura enviada" : candidatandoId === v.id ? "Enviando…" : "Candidatar-se"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </FreelancerLayout>
  );
}
