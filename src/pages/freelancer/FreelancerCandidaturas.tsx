import { useEffect, useState } from "react";
import { FreelancerProtectedRoute } from "@/components/FreelancerProtectedRoute";
import FreelancerLayout from "@/components/FreelancerLayout";
import { fetchMinhasCandidaturas } from "@/lib/freelancers/fetch";
import { supabase } from "@/lib/supabase";
import { cancelarCandidatura } from "@/lib/freelancers/actions";
import {
  CANDIDATURA_STATUS_LABEL,
  fmtDateBR,
  type CandidaturaFreelancer,
  type CandidaturaStatus,
  type VagaFreelancer,
} from "@/lib/freelancers/engine";

export default function FreelancerCandidaturas() {
  return <FreelancerProtectedRoute>{({ perfil }) => <Conteudo freelancerId={perfil.user_id} />}</FreelancerProtectedRoute>;
}

export function Conteudo({ freelancerId }: { freelancerId: string }) {
  const [candidaturas, setCandidaturas] = useState<CandidaturaFreelancer[] | null>(null);
  const [vagasPorId, setVagasPorId] = useState<Record<number, VagaFreelancer>>({});
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const c = await fetchMinhasCandidaturas(freelancerId);
      setCandidaturas(c);
      // busca as vagas referenciadas (podem já ter fechado, então não dá pra
      // reusar fetchVagasAbertas — busca direto pelos ids)
      const ids = Array.from(new Set(c.map((x) => x.vaga_id)));
      if (ids.length) {
        const { data } = await supabase.from("vagas_freelancer").select("*").in("id", ids);
        const map: Record<number, VagaFreelancer> = {};
        (data ?? []).forEach((v: VagaFreelancer) => (map[v.id] = v));
        setVagasPorId(map);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro ao carregar");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freelancerId]);

  async function handleCancelar(id: number) {
    try {
      await cancelarCandidatura(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "erro ao cancelar");
    }
  }

  return (
    <FreelancerLayout>
      <h1 className="mb-1 text-xl font-semibold">Minhas candidaturas</h1>
      <p className="mb-4 text-sm text-ink-400">Status das vagas em que você se candidatou.</p>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!candidaturas ? (
        <p className="text-ink-400">Carregando…</p>
      ) : candidaturas.length === 0 ? (
        <p className="text-ink-400">Você ainda não se candidatou a nenhuma vaga.</p>
      ) : (
        <div className="space-y-2">
          {candidaturas.map((c) => {
            const vaga = vagasPorId[c.vaga_id];
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
                <div>
                  <p className="font-medium text-ink-50">{vaga ? fmtDateBR(vaga.data) : `Vaga #${c.vaga_id}`}</p>
                  <p className="text-sm text-ink-300">{vaga?.instituicao || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(c.status)}`}>
                    {CANDIDATURA_STATUS_LABEL[c.status]}
                  </span>
                  {c.status === "pendente" && (
                    <button
                      onClick={() => handleCancelar(c.id)}
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 hover:text-ink-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FreelancerLayout>
  );
}

function statusClass(status: CandidaturaStatus): string {
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
