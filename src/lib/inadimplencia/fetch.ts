import { fetchAllRows } from "@/lib/fetchAll";
import { cached } from "@/lib/cache";
import type { InadimplenciaResumo } from "./engine";

async function loadInadimplenciaDataUncached(): Promise<InadimplenciaResumo[]> {
  return fetchAllRows<InadimplenciaResumo>("inadimplencia_resumo");
}

export function loadInadimplenciaData(): Promise<InadimplenciaResumo[]> {
  return cached("inadimplencia", loadInadimplenciaDataUncached);
}
