import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { obterUltimaAtualizacao } from "@/lib/ultimaAtualizacao";

function formatarRelativo(data: Date): string {
  const diffMin = Math.round((Date.now() - data.getTime()) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffDias = Math.round(diffH / 24);
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) return `há ${diffDias} dias`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Selo "banco atualizado há Xh" pra cada painel que lê do Supabase — dá
 * certeza visual de que os dados na tela não estão desatualizados.
 *
 * `tabelas`: as tabelas que esse painel lê (ex: ["financeiro_parcelas"]).
 * Recalcula a cada 60s pra não precisar dar refresh na página pra ver o
 * relativo ("há 2 min" -> "há 3 min") avançar.
 */
export default function UltimaAtualizacao({ tabelas }: { tabelas: string[] }) {
  const [data, setData] = useState<Date | null | undefined>(undefined);
  const chave = tabelas.join(",");
  const chaveRef = useRef(chave);

  useEffect(() => {
    chaveRef.current = chave;
    let vivo = true;
    setData(undefined);
    obterUltimaAtualizacao(tabelas).then((d) => {
      if (vivo && chaveRef.current === chave) setData(d);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // só pra avançar o texto relativo ("há 2 min" -> "há 3 min") sem reconsultar
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (data === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
        <RefreshCw className="h-3 w-3 animate-spin" />
        verificando banco…
      </span>
    );
  }
  if (data === null) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-ink-400"
      title={`Último registro no banco: ${data.toLocaleString("pt-BR")}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Banco atualizado {formatarRelativo(data)}
    </span>
  );
}
