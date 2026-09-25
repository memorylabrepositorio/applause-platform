import type { MapaDepartamento, MapaFuncao } from "./data";

/**
 * Geometria do Mapa — função pura, sem React. Recebe os departamentos e
 * devolve tudo já posicionado em coordenadas do "palco" (0,0 = centro do
 * núcleo). A página só desenha o que sai daqui.
 *
 * As medidas seguem o desenho de referência: núcleo com raio 115, anéis em
 * 168/236, ícone do departamento a 310 do centro e rótulo por fora.
 */

export type Pt = [number, number];
export interface Seg {
  a: Pt;
  b: Pt;
}

export interface MapaPonto {
  pos: Pt;
  funcao: MapaFuncao;
  delay: number;
}

export interface MapaRamo {
  stub: Seg;
  juncao: Pt;
  arestas: Seg[];
  pontos: MapaPonto[];
}

export interface MapaDeptLayout {
  dept: MapaDepartamento;
  angulo: number;
  raio: Seg;
  juncoes: Pt[];
  badge: Pt;
  rotulo: Pt;
  ramos: MapaRamo[];
  motes: { ida: string; volta: string; durIda: number; durVolta: number; beginIda: number; beginVolta: number };
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

/** posições no círculo, em graus (sentido horário a partir do topo-esquerdo) —
 *  8 posições, uma pra cada departamento real da empresa */
const ANGULOS = [202.5, 247.5, 292.5, 337.5, 22.5, 67.5, 112.5, 157.5];

export const MAPA_EXTENSAO = { largura: 2900, altura: 2980 };

// gerador pseudo-aleatório com semente — o desenho sai igual em toda visita
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const rad = (g: number) => (g * Math.PI) / 180;
const polar = (r: number, g: number): Pt => [r * Math.cos(rad(g)), r * Math.sin(rad(g))];

export function construirMapa(depts: MapaDepartamento[]): MapaLayout {
  const rnd = rng(7);

  const deptsLayout = depts.slice(0, 8).map((dept, i): MapaDeptLayout => {
    const angulo = ANGULOS[i];
    const inicio = polar(115, angulo);
    const fimRaio = polar(272, angulo);
    const badge = polar(330, angulo);
    // nenhuma das 8 posições cai exatamente na vertical, então uma
    // distância só já basta pro rótulo (sem "vazar" nas bordas)
    const rotulo = polar(920, angulo);

    const n = dept.ramos.length;
    // com 8 departamentos (45° entre cada um, vs 60° de quando eram 6),
    // a abertura dos ramos encolhe um pouco pra não invadir o vizinho
    const abertura = n === 1 ? 0 : n === 2 ? 28 : 30;
    let atraso = 0;

    const ramos = dept.ramos.map((ramo, k): MapaRamo => {
      const ang = angulo + (k - (n - 1) / 2) * abertura;
      const ux = Math.cos(rad(ang));
      const uy = Math.sin(rad(ang));
      const px = -uy;
      const py = ux;
      const stubIni: Pt = [badge[0] + ux * 44, badge[1] + uy * 44];
      const juncao: Pt = [badge[0] + ux * 92, badge[1] + uy * 92];
      const arestas: Seg[] = [];
      const pontos: MapaPonto[] = [];
      let anterior = juncao;
      ramo.forEach((funcao, s) => {
        // espaçamento maior entre os pontos do ramo — fica mais fácil de
        // acessar cada função individualmente sem errar o clique
        const ao = 92 + (s + 1) * 78;
        const zz = (s % 2 ? 1 : -1) * (8 + rnd() * 12);
        const pos: Pt = [badge[0] + ux * ao + px * zz, badge[1] + uy * ao + py * zz];
        arestas.push({ a: anterior, b: pos });
        atraso += 0.18;
        pontos.push({ pos, funcao, delay: i * 0.12 + atraso });
        anterior = pos;
      });
      return { stub: { a: stubIni, b: juncao }, juncao, arestas, pontos };
    });

    const p = (a: Pt, b: Pt) => `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} L ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
    return {
      dept,
      angulo,
      raio: { a: inicio, b: fimRaio },
      juncoes: [polar(168, angulo), polar(236, angulo)],
      badge,
      rotulo,
      ramos,
      motes: {
        ida: p(inicio, badge),
        volta: p(badge, inicio),
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
    const r = 140 * Math.sqrt(rnd());
    const t = rnd() * Math.PI * 2;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  const nucleo: Pt = [-26, -19.5];
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

  return { depts: deptsLayout, nucleo: { arestas, pontos, nucleo, satelite: [22.1, 24.7] }, estrelas };
}
