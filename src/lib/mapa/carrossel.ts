import type { MapaDepartamento, MapaFuncao } from "./data";

/**
 * Geometria do carrossel de esferas — função pura, sem React.
 *
 * O "anel" é um círculo visto quase de frente (inclinado com rotateX no
 * CSS): cada departamento ocupa uma posição angular relativa ao que está
 * em foco. Ao trocar o foco, só recalculamos os ângulos — a posição em si
 * anima via transition no CSS.
 *
 * Tudo aqui é pensado pra caber numa "moldura" de referência de
 * REFERENCIA.largura × REFERENCIA.altura, que a página depois escala
 * (transform: scale) pra caber na área visível — o mesmo truque que o
 * mapa antigo usava com "ajuste".
 */

export const REFERENCIA = { largura: 1400, altura: 900 };

/** graus de inclinação do anel (rotateX) — dá a sensação de profundidade 3D */
export const INCLINACAO = 23;

const PASSO_ANGULO = 30; // graus entre duas posições vizinhas no anel
const RAIO_X = 540;
const PROFUNDIDADE = 460;

export interface AnelItem {
  dept: MapaDepartamento;
  rel: number;
  x: number;
  z: number;
  escala: number;
  opacidade: number;
  blur: number;
  zIndex: number;
  emFoco: boolean;
}

/** posições do anel pro departamento `focoIdx` centralizado */
export function construirAnel(depts: MapaDepartamento[], focoIdx: number): AnelItem[] {
  const n = depts.length;
  return depts.map((dept, i) => {
    let rel = i - focoIdx;
    if (rel > n / 2) rel -= n;
    if (rel < -n / 2) rel += n;
    const rad = ((rel * PASSO_ANGULO) * Math.PI) / 180;
    const x = Math.sin(rad) * RAIO_X;
    const z = Math.cos(rad) * PROFUNDIDADE - PROFUNDIDADE;
    // queda de escala/opacidade em curva côncava — mais suave que linear
    const escala = Math.max(0.42, 0.48 + 0.52 * Math.pow(Math.cos(rad), 1.4));
    const opacidade = Math.max(0.16, Math.pow(Math.cos(rad * 0.85), 2.2));
    const blur = Math.min(5, Math.pow(Math.abs(rel), 1.3) * 1.5);
    return { dept, rel, x, z, escala, opacidade, blur, zIndex: 100 - Math.abs(rel), emFoco: rel === 0 };
  });
}

export interface FocoBloco {
  funcao: MapaFuncao;
  pos: [number, number];
}

export interface FocoLayout {
  blocos: FocoBloco[];
}

// gerador pseudo-aleatório com semente — o desenho de cada departamento
// sai sempre igual (mesma técnica do mapa antigo)
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function semente(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 999999;
  return h + 1;
}

/** distribui as funções do departamento ao redor do centro, numa elipse
 *  generosa — o raio cresce com a quantidade pra nunca sobrepor os blocos */
export function construirFoco(dept: MapaDepartamento): FocoLayout {
  const funcoes = dept.ramos.flat();
  const n = funcoes.length;
  const rnd = rng(semente(dept.id));
  const raioBase = 300 + n * 18;
  const rx = raioBase;
  const ry = raioBase * 0.72;
  const passo = 360 / n;
  // começa um pouco fora do topo exato, pra nenhum bloco cair "espremido"
  // bem no ápice/base da elipse (onde ry aperta mais o espaço vertical)
  const offset = -90 + passo / 2;
  const blocos: FocoBloco[] = funcoes.map((funcao, i) => {
    const ang = offset + i * passo + (rnd() - 0.5) * (passo * 0.18);
    const rad = (ang * Math.PI) / 180;
    const x = Math.cos(rad) * rx;
    const y = Math.sin(rad) * ry;
    return { funcao, pos: [x, y] };
  });
  return { blocos };
}
