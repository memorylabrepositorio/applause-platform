import { supabase } from "@/lib/supabase";

// paginação de 1000 linhas por request (limite da API do Supabase) —
// busca o total primeiro, depois todas as páginas em paralelo
export async function fetchAllRows<T>(table: string, columns = "*"): Promise<T[]> {
  const PAGE = 1000;
  const { count, error: countError } = await supabase
    .from(table)
    .select(columns, { count: "exact", head: true });
  if (countError) throw countError;

  const total = count || 0;
  if (total === 0) return [];

  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += PAGE) offsets.push(offset);

  const chunks = await Promise.all(
    offsets.map(async (offset) => {
      const { data, error } = await supabase.from(table).select(columns).range(offset, offset + PAGE - 1);
      if (error) throw error;
      return (data || []) as T[];
    })
  );
  return chunks.flat();
}
