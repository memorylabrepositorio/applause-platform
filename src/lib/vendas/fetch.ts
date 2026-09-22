import { supabase } from "@/lib/supabase";
import { buildRowsFromSupabase, type VendaRow } from "./engine";

// a API do Supabase limita 1000 linhas por request — busca o total primeiro,
// depois todas as páginas em paralelo (mesmo truque do painel original)
async function fetchAllRows<T>(table: string): Promise<T[]> {
  const PAGE = 1000;
  const { count, error: countError } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (countError) throw countError;

  const total = count || 0;
  if (total === 0) return [];

  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += PAGE) offsets.push(offset);

  const chunks = await Promise.all(
    offsets.map(async (offset) => {
      const { data, error } = await supabase.from(table).select("*").range(offset, offset + PAGE - 1);
      if (error) throw error;
      return (data || []) as T[];
    })
  );
  return chunks.flat();
}

export async function loadVendasData(): Promise<VendaRow[]> {
  const [vendas, contratos, agenda] = await Promise.all([
    fetchAllRows<any>("vendas"),
    fetchAllRows<any>("contratos"),
    fetchAllRows<any>("agenda"),
  ]);
  return buildRowsFromSupabase(vendas, contratos, agenda);
}
