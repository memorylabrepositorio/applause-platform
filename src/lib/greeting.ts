import type { Session } from "@supabase/supabase-js";

/**
 * Saudação por voz ao logar — "Bom dia/Boa tarde/Boa noite, {nome}".
 *
 * Usa a Web Speech API (SpeechSynthesis), nativa do navegador — sem custo,
 * sem chave de API, sem gravação de áudio pra manter. A troca é: a voz
 * depende do que o sistema operacional/navegador do usuário tem instalado
 * (no Chrome/Edge no Windows costuma vir uma voz pt-BR razoável; em
 * navegadores sem voz em português, cai pra voz padrão do sistema mesmo
 * assim, só que com sotaque estrangeiro).
 *
 * É o mesmo mecanismo usado, no futuro, pro reconhecimento de comando de voz
 * (SpeechRecognition é a contraparte de entrada dessa mesma API) — dá pra
 * evoluir sem trocar de abordagem.
 */

export function saudacaoPorHorario(data: Date = new Date()): string {
  const hora = data.getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Nome/apelido pra saudação. Ordem de prioridade:
 *  1) apelido escolhido pela pessoa em Configurações (livre, sem alterações)
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

let vozesPtCache: SpeechSynthesisVoice[] | null = null;

function vozesPt(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (vozesPtCache) return resolve(vozesPtCache);
    const synth = window.speechSynthesis;
    const pegar = () => synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("pt"));
    let vozes = pegar();
    if (vozes.length > 0) {
      vozesPtCache = vozes;
      return resolve(vozes);
    }
    // em muitos navegadores a lista de vozes carrega assíncrono no 1º acesso
    const timeout = setTimeout(() => resolve(pegar()), 350);
    synth.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timeout);
        vozes = pegar();
        vozesPtCache = vozes;
        resolve(vozes);
      },
      { once: true }
    );
  });
}

/** Fala a saudação. Falha em silêncio se o navegador não suportar —
 *  nunca deve travar ou atrapalhar o fluxo de login. */
export async function falarSaudacao(nome: string | null): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const texto = nome ? `${saudacaoPorHorario()}, ${nome}` : `${saudacaoPorHorario()}!`;
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "pt-BR";
    utter.rate = 1;
    utter.pitch = 1;

    const vozes = await vozesPt();
    // prioriza uma voz pt-BR especificamente, senão qualquer pt
    const voz = vozes.find((v) => v.lang?.toLowerCase() === "pt-br") ?? vozes[0];
    if (voz) utter.voice = voz;

    window.speechSynthesis.cancel(); // evita empilhar se algo já estiver falando
    window.speechSynthesis.speak(utter);
  } catch {
    /* navegador sem suporte, bloqueado por permissão, etc. — segue o jogo */
  }
}
