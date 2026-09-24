/**
 * Cache simples em memória pros dados carregados do Supabase.
 *
 * Sem isso, cada troca de painel refaz do zero as mesmas consultas grandes
 * (vendas, contratos, clientes, agenda...) — é isso que deixa a navegação
 * lenta. Aqui, o resultado (ou a Promise em andamento, pra não disparar duas
 * consultas iguais em paralelo se dois componentes pedirem ao mesmo tempo)
 * fica guardado por um tempo curto; depois disso, ou se alguém salvar algo
 * novo (e chamar invalidateCache), a próxima leitura busca de novo.
 *
 * É por sessão de navegador só — não persiste entre recarregamentos de
 * página nem é compartilhado entre pessoas.
 */
interface Entry {
  promise: Promise<unknown>;
  expiresAt: number;
}

const store = new Map<string, Entry>();

const DEFAULT_TTL = 3 * 60 * 1000; // 3 minutos

export function cached<T>(key: string, loader: () => Promise<T>, ttlMs: number = DEFAULT_TTL): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;

  const promise = loader().catch((e) => {
    // não guarda erro em cache — a próxima chamada tenta de novo do zero
    store.delete(key);
    throw e;
  });
  store.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

/** Força a próxima leitura dessa(s) chave(s) (ou de tudo, se omitido) a buscar de novo. */
export function invalidateCache(keys?: string | string[]) {
  if (!keys) {
    store.clear();
    return;
  }
  (Array.isArray(keys) ? keys : [keys]).forEach((k) => store.delete(k));
}
