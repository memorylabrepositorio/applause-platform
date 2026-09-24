import type { Session } from "@supabase/supabase-js";

/**
 * Saudação por voz ao logar — mensagem e voz personalizáveis pela pessoa em
 * Configurações > Aparência.
 *
 * Usa a Web Speech API (SpeechSynthesis), nativa do navegador — sem custo,
 * sem chave de API, sem áudio gravado pra manter. A troca é: as vozes
 * disponíveis dependem do que o sistema operacional/navegador da pessoa tem
 * instalado (varia de máquina pra máquina).
 *
 * É o mesmo mecanismo usado, no futuro, pro reconhecimento de comando de voz
 * (SpeechRecognition é a contraparte de entrada dessa mesma API) — dá pra
 * evoluir sem trocar de abordagem.
 */

export type Periodo = "manha" | "tarde" | "noite";

export const SAUDACAO_PADRAO: Record<Periodo, string> = {
  manha: "Bom dia, {nome}",
  tarde: "Boa tarde, {nome}",
  noite: "Boa noite, {nome}",
};

export function periodoAtual(data: Date = new Date()): Periodo {
  const hora = data.getHours();
  if (hora >= 5 && hora < 12) return "manha";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noite";
}

/** Mantido pelo nome antigo por compatibilidade — devolve só o rótulo do período. */
export function saudacaoPorHorario(data: Date = new Date()): string {
  const rotulo: Record<Periodo, string> = { manha: "Bom dia", tarde: "Boa tarde", noite: "Boa noite" };
  return rotulo[periodoAtual(data)];
}

/** Monta o texto final a partir do template do período, trocando {nome} —
 *  e removendo a vírgula/espaço órfãos quando não há nome a inserir. */
export function montarTexto(template: string, nome: string | null): string {
  const base = template?.trim() || SAUDACAO_PADRAO.manha;
  if (nome && nome.trim()) return base.replace(/\{nome\}/g, nome.trim());
  return base
    .replace(/,?\s*\{nome\}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** O apelido é por PESSOA (id do usuário no Supabase Auth), não por
 *  computador/navegador — senão, num dispositivo compartilhado, o apelido de
 *  quem logou primeiro "gruda" e é falado pro próximo que logar depois. */
function apelidoKey(uid: string): string {
  return `applause_apelido_${uid}`;
}

export function lerApelido(session: Session | null): string {
  const uid = session?.user?.id;
  if (!uid) return "";
  try {
    return localStorage.getItem(apelidoKey(uid)) ?? "";
  } catch {
    return "";
  }
}

export function salvarApelido(session: Session | null, valor: string): void {
  const uid = session?.user?.id;
  if (!uid) return;
  try {
    localStorage.setItem(apelidoKey(uid), valor);
  } catch {
    /* localStorage indisponível — segue só na sessão */
  }
}

/** Nome/apelido pra saudação. Ordem de prioridade:
 *  1) apelido escolhido pela pessoa em Configurações (livre, sem alterações) —
 *     guardado por pessoa, não por computador (ver lerApelido/salvarApelido)
 *  2) nome cadastrado no Supabase Auth (user_metadata.full_name / name)
 *  3) derivado do e-mail, como último recurso */
export function primeiroNome(session: Session | null, apelido?: string): string | null {
  if (apelido && apelido.trim()) return apelido.trim();

  const user = session?.user;
  if (!user) return null;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const metaNome = (meta?.full_name ?? meta?.name) as string | undefined;
  if (metaNome && metaNome.trim()) {
    return capitalizar(metaNome.trim().split(/\s+/)[0]);
  }

  const email = user.email;
  if (!email) return null;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return null;
  return capitalizar(local.split(" ")[0]);
}

function capitalizar(palavra: string): string {
  if (!palavra) return palavra;
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
}

let vozesCache: SpeechSynthesisVoice[] | null = null;

/** Lista todas as vozes que o navegador tem instaladas (não só pt) — pra
 *  gente deixar a pessoa escolher em Configurações. */
export function listarVozes(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    if (vozesCache) return resolve(vozesCache);
    const synth = window.speechSynthesis;
    let vozes = synth.getVoices();
    if (vozes.length > 0) {
      vozesCache = vozes;
      return resolve(vozes);
    }
    // em muitos navegadores a lista de vozes carrega assíncrono no 1º acesso
    const timeout = setTimeout(() => resolve(synth.getVoices()), 350);
    synth.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timeout);
        vozes = synth.getVoices();
        vozesCache = vozes;
        resolve(vozes);
      },
      { once: true }
    );
  });
}

/** Identificador estável de uma voz, pra guardar a escolha da pessoa
 *  (SpeechSynthesisVoice não serializa — guardamos nome+idioma e re-buscamos
 *  na lista atual na hora de falar). */
export function idDaVoz(v: Pick<SpeechSynthesisVoice, "name" | "lang">): string {
  return `${v.name}|${v.lang}`;
}

function escolherVoz(vozes: SpeechSynthesisVoice[], vozPreferidaId?: string): SpeechSynthesisVoice | undefined {
  if (vozPreferidaId) {
    const escolhida = vozes.find((v) => idDaVoz(v) === vozPreferidaId);
    if (escolhida) return escolhida;
    // a voz salva não existe mais nesse navegador (trocou de máquina, etc.) — cai pro padrão
  }
  return vozes.find((v) => v.lang?.toLowerCase() === "pt-br") ?? vozes.find((v) => v.lang?.toLowerCase().startsWith("pt"));
}

/** Fala a saudação. Falha em silêncio se o navegador não suportar —
 *  nunca deve travar ou atrapalhar o fluxo de login.
 *  `template` é o texto com {nome}; `vozId` é o id (nome|idioma) da voz escolhida em Configurações. */
export async function falarSaudacao(nome: string | null, template?: string, vozId?: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const texto = montarTexto(template ?? SAUDACAO_PADRAO[periodoAtual()], nome);
    const utter = new SpeechSynthesisUtterance(texto);
    utter.rate = 1;
    utter.pitch = 1;

    const vozes = await listarVozes();
    const voz = escolherVoz(vozes, vozId);
    if (voz) utter.voice = voz;
    utter.lang = voz?.lang ?? "pt-BR";

    window.speechSynthesis.cancel(); // evita empilhar se algo já estiver falando
    window.speechSynthesis.speak(utter);
  } catch {
    /* navegador sem suporte, bloqueado por permissão, etc. — segue o jogo */
  }
}
