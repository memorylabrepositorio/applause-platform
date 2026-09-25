import type { MapaDepartamento, MapaFuncao } from "./data";

/**
 * Geometria do Mapa — função pura, sem React.
 *
 * Cada departamento se liga ao núcleo por uma curva suave ("sinapse"), não
 * por uma linha reta. Pra não virar um nó de linhas cruzadas no centro,
 * duas coisas importam: (1) cada curva nasce num ponto já separado dos
 * outros, numa "gola" pequena ao redor do núcleo, na direção do próprio
 * setor — não todas saindo do mesmo pixel; (2) todas arqueiam pro mesmo
 * lado (sentido horário), então formam um redemoinho suave em vez de se
 * cruzar. Poucos elementos, traço fino — refinado, não decorado.
 *
 * As funções de um departamento não ficam mais desenhadas no mapa: ficam
 * num painel lateral (setor em foco/hover) e, ao clicar de novo no setor,
 * numa tela cheia com a mesma linguagem (ver construirFoco).
 */

export type Pt = [number, number];

export interface MapaDeptLayout {
  dept: MapaDepartamento;
  angulo: number;
  sinapseIda: string;
  badge: Pt;
  rotulo: Pt;
  mote: { dur: number; begin: number };
}

export interface MapaNucleoLayout {
  nucleo: Pt;
  satelite: Pt;
}

export interface MapaEstrela {
  left: number;
  top: number;
  size: number;
  delay: number;
  dur: number;
}

export interface MapaLayout {
  depts: MapaDeptLayout[];
  nucleo: MapaNucleoLayout;
  estrelas: MapaEstrela[];
}

export interface MapaFocoPonto {
  funcao: MapaFuncao;
  pos: Pt;
  curva: string;
}

/** posições no círculo, em graus — 8 posições, uma pra cada setor real da empresa */
const ANGULOS = [202.5, 247.5, 292.5, 337.5, 22.5, 67.5, 112.5, 157.5];

export const MAPA_EXTENSAO = { largura: 1320, altura: 1320 };

// gerador pseudo-aleatório com semente — o desenho sai igual em toda visita
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const rad = (g: number) => (g * Math.PI) / 180;
const polar = (r: number, g: number): Pt => [r * Math.cos(rad(g)), r * Math.sin(rad(g))];
const p1 = (v: Pt) => `${v[0].toFixed(2)} ${v[1].toFixed(2)}`;

/** curva suave entre dois pontos, sempre arqueando no mesmo sentido
 *  (redemoinho, não zig-zag) — `desvio` é discreto de propósito. */
function sinapse(a: Pt, b: Pt, desvio: number, rnd: () => number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c1: Pt = [a[0] + dx * 0.33 + nx * desvio * (0.7 + rnd() * 0.3), a[1] + dy * 0.33 + ny * desvio * (0.7 + rnd() * 0.3)];
  const c2: Pt = [a[0] + dx * 0.66 + nx * desvio * (0.4 + rnd() * 0.3), a[1] + dy * 0.66 + ny * desvio * (0.4 + rnd() * 0.3)];
  return `M ${p1(a)} C ${p1(c1)}, ${p1(c2)}, ${p1(b)}`;
}

export function construirMapa(depts: MapaDepartamento[]): MapaLayout {
  const rnd = rng(7);

  const deptsLayout = depts.slice(0, 8).map((dept, i): MapaDeptLayout => {
    const angulo = ANGULOS[i];
    const badge = polar(300, angulo);
    const rotulo = polar(398, angulo);
    // a curva nasce numa "gola" pequena ao redor do núcleo, já na direção
    // do próprio setor — assim as 8 curvas não se encontram no mesmo pixel
    const origem = polar(18, angulo);
    const desvio = 24 * (0.85 + rnd() * 0.3);
    const ida = sinapse(origem, badge, desvio, rnd);

    return {
      dept,
      angulo,
      sinapseIda: ida,
      badge,
      rotulo,
      mote: { dur: 3.4 + rnd() * 1.8, begin: i * 0.5 },
    };
  });

  const estrelas: MapaEstrela[] = Array.from({ length: 90 }, () => ({
    left: rnd() * 100,
    top: rnd() * 100,
    size: rnd() < 0.25 ? 2 : 1,
    delay: rnd() * 6,
    dur: 4 + rnd() * 5,
  }));

  return { depts: deptsLayout, nucleo: { nucleo: [0, 0], satelite: [15, 11] }, estrelas };
}

/** layout da "tela cheia" de um setor: n funções em roda ao redor do centro,
 *  cada uma ligada por uma curva-sinapse — mesma linguagem visual do mapa
 *  geral, num redemoinho suave em vez de um nó cruzado. */
export function construirFoco(funcoes: MapaFuncao[]): MapaFocoPonto[] {
  const rnd = rng(31 + funcoes.length);
  const n = funcoes.length;
  // com mais funções o raio cresce — senão os cartões (largos) se
  // amontoam nos setores com 8-9 itens. A tela é mais larga que alta, então
  // o "círculo" vira uma elipse achatada — senão os cartões de cima/baixo
  // saem da área visível antes dos da lateral.
  const raioBase = 250 + n * 14;
  return funcoes.map((funcao, i) => {
    const ang = (i / n) * 360 - 90 + (rnd() - 0.5) * 4;
    const rx = raioBase + rnd() * 22;
    const ry = (raioBase + rnd() * 22) * 0.64;
    const pos: Pt = [rx * Math.cos(rad(ang)), ry * Math.sin(rad(ang))];
    const origem = polar(20, ang);
    const desvio = 26 * (0.8 + rnd() * 0.3);
    const curva = sinapse(origem, pos, desvio, rnd);
    return { funcao, pos, curva };
  });
}
