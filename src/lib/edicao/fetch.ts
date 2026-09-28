import { fetchAllRows } from "@/lib/fetchAll";
import { cached } from "@/lib/cache";
import type { FunilAlbunsItem, ProducaoEdicaoItem } from "./engine";

export interface EdicaoData {
  producao: ProducaoEdicaoItem[];
  funil: FunilAlbunsItem[];
}

async function loadEdicaoDataUncached(): Promise<EdicaoData> {
  const [producao, funil] = await Promise.all([
    fetchAllRows<ProducaoEdicaoItem>("producao_edicao"),
    fetchAllRows<FunilAlbunsItem>("funil_albuns"),
  ]);
  return { producao, funil };
}

export function loadEdicaoData(): Promise<EdicaoData> {
  return cached("edicao", loadEdicaoDataUncached);
}
