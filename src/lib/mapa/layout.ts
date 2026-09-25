import type { MapaDepartamento, MapaFuncao } from "./data";

/**
 * Geometria do Mapa — função pura, sem React.
 *
 * Cada departamento se liga ao núcleo por uma curva orgânica ("sinapse"),
 * não por uma linha reta — a ideia é lembrar dendritos de um neurônio
 * disparando. As funções de um departamento não ficam mais desenhadas
 * direto no mapa: ficam num painel lateral (setor em foco) e, ao "entrar"
 * no setor, numa tela cheia com o mesmo estilo de sinapse — o núcleo dessa
 * tela vira o próprio departamento e cada função é um nó ao redor dele
 * (ver construirFoco).
 */

export type Pt = [number, number];
export interface Seg {
  a: Pt;
  b: Pt;
}

export interface MapaDeptLayout {
  dept: MapaDepartamento;
  angulo: number;
  sinapseIda: string;
  sinapseVolta: string;
  sinapsePontos: Pt[];
  juncoes: Pt[];
  badge: Pt;
  rotulo: Pt;
  dendritos: string[];
  motes: { durIda: number; durVolta: number; beginIda: number; beginVolta: number };
}

export interface MapaNucleoLayout {
  arestas: { seg: Seg; opacidade: number; tracejada: boolean }[];
  pontos: { pos: Pt; r: number; cor: string | null; opacidade: number }[];
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
  pontos: Pt[];
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
const desloc = (base: Pt, r: number, g: number): Pt => [base[0] + r * Math.cos(rad(g)), base[1] + r * Math.sin(rad(g))];

const p1 = (v: Pt) => `${v[0].toFixed(2)} ${v[1].toFixed(2)}`;

function bezierPt(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t;
  const x = mt ** 3 * a[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * b[0];
  const y = mt ** 3 * a[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * b[1];
  return [x, y];
}

/** curva orgânica entre dois pontos — dendrito/sinapse. `desvio` controla
 *  o quanto a curva "arqueia" pra fora da linha reta entre os pontos. */
function sinapse(a: Pt, b: Pt, desvio: number, rnd: () => number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c1: Pt = [a[0] + dx * 0.33 + nx * desvio * (0.6 + rnd() * 0.5), a[1] + dy * 0.33 + ny * desvio * (0.6 + rnd() * 0.5)];
  const c2: Pt = [a[0] + dx * 0.66 + nx * desvio * (0.3 + rnd() * 0.5), a[1] + dy * 0.66 + ny * desvio * (0.3 + rnd() * 0.5)];
  const ida = `M ${p1(a)} C ${p1(c1)}, ${p1(c2)}, ${p1(b)}`;
  const volta = `M ${p1(b)} C ${p1(c2)}, ${p1(c1)}, ${p1(a)}`;
  const pontos = [0.22, 0.4, 0.58, 0.76].map((t) => bezierPt(a, c1, c2, b, t));
  return { ida, volta, pontos };
}

export function construirMapa(depts: MapaDepartamento[]): MapaLayout {
  const rnd = rng(7);
  const nucleoOrigem: Pt = [0, 0];

  const deptsLayout = depts.slice(0, 8).map((dept, i): MapaDeptLayout => {
    const angulo = ANGULOS[i];
    const badge = polar(300, angulo);
    const rotulo = polar(398, angulo);

    const desvio = 66 * (i % 2 === 0 ? 1 : -1) * (0.75 + rnd() * 0.4);
    const { ida, volta, pontos } = sinapse(nucleoOrigem, badge, desvio, rnd);

    // dendritos decorativos saindo do badge — só pra sugerir que ali tem
    // mais coisa (as funções de verdade ficam no painel / tela cheia)
    const nDend = 2 + (i % 2);
    const dendritos: string[] = [];
    for (let k = 0; k < nDend; k++) {
      const a2 = angulo + (k - (nDend - 1) / 2) * 24;
      const ponta = desloc(badge, 72, a2);
      dendritos.push(sinapse(badge, ponta, 14 * (k % 2 === 0 ? 1 : -1), rnd).ida);
    }

    return {
      dept,
      angulo,
      sinapseIda: ida,
      sinapseVolta: volta,
      sinapsePontos: pontos,
      juncoes: [polar(168, angulo), polar(236, angulo)],
      badge,
      rotulo,
      dendritos,
      motes: {
        durIda: 2.6 + rnd() * 1.6,
        durVolta: 3.5 + rnd(),
        beginIda: i * 0.43,
        beginVolta: 1.3 + i * 0.6,
      },
    };
  });

  // núcleo: nuvem de pontos com arestas partindo do centro
  const cores = depts.map((d) => d.cor);
  const pts: Pt[] = [];
  for (let i = 0; i < 150; i++) {
    const r = 130 * Math.sqrt(rnd());
    const t = rnd() * Math.PI * 2;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  const nucleo: Pt = [-24, -18];
  const arestas: MapaNucleoLayout["arestas"] = pts
    .slice(0, 28)
    .map((b) => ({ seg: { a: nucleo, b }, opacidade: 0.1 + rnd() * 0.15, tracejada: false }));
  for (let i = 0; i < 14; i++) {
    const a = pts[Math.floor(rnd() * pts.length)];
    const b = pts[Math.floor(rnd() * pts.length)];
    arestas.push({ seg: { a, b }, opacidade: 0.06 + rnd() * 0.08, tracejada: true });
  }
  const pontos = pts.map((pos) => ({
    pos,
    r: 1 + rnd() * 1.3,
    cor: rnd() < 0.45 ? cores[Math.floor(rnd() * cores.length)] : null,
    opacidade: 0.4 + rnd() * 0.5,
  }));

  const estrelas: MapaEstrela[] = Array.from({ length: 110 }, () => ({
    left: rnd() * 100,
    top: rnd() * 100,
    size: rnd() < 0.25 ? 2 : 1,
    delay: rnd() * 6,
    dur: 4 + rnd() * 5,
  }));

  return { depts: deptsLayout, nucleo: { arestas, pontos, nucleo, satelite: [20.5, 23] }, estrelas };
}

/** layout da "tela cheia" de um setor: n funções em roda ao redor do centro,
 *  cada uma ligada por uma curva-sinapse — mesma linguagem visual do mapa
 *  geral, só que o centro agora é o próprio setor. */
export function construirFoco(funcoes: MapaFuncao[]): MapaFocoPonto[] {
  const rnd = rng(31 + funcoes.length);
  const n = funcoes.length;
  const origem: Pt = [0, 0];
  return funcoes.map((funcao, i) => {
    const ang = (i / n) * 360 - 90 + (rnd() - 0.5) * 10;
    const r = 300 + rnd() * 60;
    const pos = polar(r, ang);
    const desvio = 55 * (i % 2 === 0 ? 1 : -1) * (0.7 + rnd() * 0.5);
    const { ida, pontos } = sinapse(origem, pos, desvio, rnd);
    return { funcao, pos, curva: ida, pontos };
  });
}
