import { supabase } from "@/lib/supabase";

/**
 * Indicador visual de "até quando" o banco está refletido no painel.
 *
 * Painéis que o próprio usuário edita (financeiro_parcelas, contas_pagar,
 * producao_itens, checklist_eventos...) sempre têm atualizado_em/criado_em,
 * então o valor é exato. Painéis alimentados pelo script Python do Pronet
 * (clientes, contratos, vendas, agenda) podem ou não ter uma coluna de data —
 * por isso tentamos várias colunas candidatas e, se nenhuma existir na
 * tabela, simplesmente não mostramos nada pra ela em vez de quebrar o painel.
 */
const COLUNAS_CANDIDATAS = ["atualizado_em", "criado_em", "updated_at", "created_at"];

// cacheia, por tabela, qual coluna funcionou (ou que nenhuma funcionou) —
// evita repetir tentativas que vão falhar em toda troca de painel.
const colunaPorTabela = new Map<string, string | null>();

async function maxDaTabela(tabela: string): Promise<Date | null> {
  const conhecida = colunaPorTabela.get(tabela);
  const candidatos = conhecida !== undefined ? (conhecida ? [conhecida] : []) : COLUNAS_CANDIDATAS;

  for (const coluna of candidatos) {
    try {
      const { data, error } = await supabase
        .from(tabela)
        .select(coluna)
        .not(coluna, "is", null)
        .order(coluna, { ascending: false })
        .limit(1);

      if (!error && data && data.length) {
        colunaPorTabela.set(tabela, coluna);
        const valor = (data[0] as unknown as Record<string, string>)[coluna];
        return valor ? new Date(valor) : null;
      }
      // coluna inexistente (42703) ou tabela vazia — tenta a próxima candidata
    } catch {
      // falha de rede/conexão — não deixa o painel quebrar por causa do selo
      return null;
    }
  }
  colunaPorTabela.set(tabela, null);
  return null;
}

/** Maior data de atualização entre as tabelas informadas. */
export async function obterUltimaAtualizacao(tabelas: string[]): Promise<Date | null> {
  const datas = await Promise.all(tabelas.map(maxDaTabela));
  const validas = datas.filter((d): d is Date => d !== null);
  if (!validas.length) return null;
  return new Date(Math.max(...validas.map((d) => d.getTime())));
}
