import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { DEPARTAMENTOS, MAPA_FOCO_INICIAL, MAPA_NUCLEO, type MapaDepartamento, type MapaFuncao } from "@/lib/mapa/data";
import { construirMapa, MAPA_EXTENSAO, type Pt, type Seg } from "@/lib/mapa/layout";
import "./Mapa.css";

const d = (s: Seg) => `M ${s.a[0].toFixed(2)} ${s.a[1].toFixed(2)} L ${s.b[0].toFixed(2)} ${s.b[1].toFixed(2)}`;
const at = (p: Pt): CSSProperties => ({ left: `${p[0].toFixed(2)}px`, top: `${p[1].toFixed(2)}px` });
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// zoom acima de 100% por padrão — o "ajuste" sozinho deixa o mapa cabendo
// certinho no espaço, mas pequeno; isso faz ele ocupar mais tela de cara
const ZOOM_PADRAO = 1.22;

interface Dica {
  x: number;
  y: number;
  funcao: MapaFuncao;
  dept: MapaDepartamento;
}

export default function Mapa() {
  const navigate = useNavigate();
  const mapa = useMemo(() => construirMapa(DEPARTAMENTOS), []);
  const depts = mapa.depts;
  const total = useMemo(() => depts.reduce((n, x) => n + x.dept.ramos.flat().length, 0), [depts]);

  const [focoId, setFocoId] = useState(
    depts.some((x) => x.dept.id === MAPA_FOCO_INICIAL) ? MAPA_FOCO_INICIAL : depts[0]?.dept.id
  );
  const [ajuste, setAjuste] = useState(0.3);
  const [zoom, setZoom] = useState(ZOOM_PADRAO);
  const [busca, setBusca] = useState("");
  const [dica, setDica] = useState<Dica | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  // ao passar o mouse num departamento, os outros escurecem — só ele (ramos,
  // rótulo, anéis) fica em destaque, tipo um "spotlight"
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverNucleo, setHoverNucleo] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // escala "Ajustar": cabe o mapa inteiro na área visível
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // no celular o mapa pode "vazar" um pouco nas laterais (rótulos) pra não ficar minúsculo
    const medir = () =>
      setAjuste(
        Math.min(
          el.clientWidth / (el.clientWidth < 700 ? MAPA_EXTENSAO.largura * 0.78 : MAPA_EXTENSAO.largura),
          el.clientHeight / MAPA_EXTENSAO.altura
        )
      );
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setTelaCheia(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const idx = Math.max(0, depts.findIndex((x) => x.dept.id === focoId));
  const N = depts.length;
  const foco = depts[idx]?.dept;
  const anterior = depts[(idx - 1 + N) % N]?.dept;
  const proximo = depts[(idx + 1) % N]?.dept;

  const irPara = useCallback((passo: number) => {
    setFocoId((atual) => {
      const i = depts.findIndex((x) => x.dept.id === atual);
      return depts[(i + passo + depts.length) % depts.length].dept.id;
    });
  }, [depts]);

  // setas do teclado trocam o departamento em destaque
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;
      if (e.key === "ArrowLeft") irPara(-1);
      if (e.key === "ArrowRight") irPara(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [irPara]);

  const termo = semAcento(busca.trim());
  const achados = useMemo(() => {
    if (!termo) return [] as MapaFuncao[];
    return depts.flatMap((x) => x.dept.ramos.flat()).filter((f) => semAcento(f.nome).includes(termo));
  }, [termo, depts]);

  function abrir(funcao: MapaFuncao) {
    if (funcao.to) navigate(funcao.to);
  }

  function telaCheiaToggle() {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }

  const escala = ajuste * zoom;

  return (
    <Layout>
      <div className="mapa" ref={boxRef}>
        <div className="mapa-estrelas" aria-hidden="true">
          {mapa.estrelas.map((s, i) => (
            <span
              key={i}
              className="mapa-estrela"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay.toFixed(2)}s`,
                animationDuration: `${s.dur.toFixed(2)}s`,
              }}
            />
          ))}
        </div>

        <div className="mapa-topo">
          <button type="button" className="mapa-vidro mapa-btn" onClick={telaCheiaToggle} aria-label="Alternar tela cheia">
            {telaCheia ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <label className="mapa-vidro mapa-busca">
            <Search size={15} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && achados.length === 1) abrir(achados[0]);
                if (e.key === "Escape") setBusca("");
              }}
              placeholder={`buscar ${total} funções · SDR, convites, Pronet, álbuns…`}
              aria-label="Buscar funções no mapa"
              autoComplete="off"
              spellCheck={false}
            />
            {termo && <span className="mapa-busca-n">{achados.length}</span>}
          </label>
          <span className="mapa-aba">MAPA</span>
        </div>

        <div className="mapa-viewport">
          <div
            className={`mapa-palco${termo ? " buscando" : ""}`}
            style={{ transform: `translate(0px, 30px) scale(${escala})` }}
          >
            <svg className={`mapa-svg${hoverId ? " apagando" : ""}`} width={3200} height={3200} viewBox="-1600 -1600 3200 3200" aria-hidden="true">
              <circle r={168} className="mapa-anel" strokeDasharray="2 9" />
              <circle r={236} className="mapa-anel" strokeDasharray="1 6" />

              {depts.map((x) => (
                <g key={x.dept.id} className={`mapa-svg-dept${hoverId && hoverId !== x.dept.id ? " apagado" : ""}`}>
                  <path d={d(x.raio)} className="mapa-raio" />
                  {x.juncoes.map((j, k) => (
                    <circle key={k} cx={j[0]} cy={j[1]} r={1.8} className="mapa-juncao" />
                  ))}
                  <circle r={2.4} className="mapa-mote">
                    <animateMotion dur={`${x.motes.durIda.toFixed(2)}s`} begin={`${x.motes.beginIda.toFixed(2)}s`} repeatCount="indefinite" path={x.motes.ida} />
                  </circle>
                  <circle r={1.7} className="mapa-mote claro">
                    <animateMotion dur={`${x.motes.durVolta.toFixed(2)}s`} begin={`${x.motes.beginVolta.toFixed(2)}s`} repeatCount="indefinite" path={x.motes.volta} />
                  </circle>
                </g>
              ))}

              <g className="mapa-cerebro">
                {mapa.nucleo.arestas.map((a, i) => (
                  <path
                    key={i}
                    d={d(a.seg)}
                    className="mapa-cerebro-aresta"
                    strokeOpacity={a.opacidade}
                    strokeDasharray={a.tracejada ? "1.5 3" : undefined}
                  />
                ))}
                {mapa.nucleo.pontos.map((p, i) => (
                  <circle key={i} cx={p.pos[0]} cy={p.pos[1]} r={p.r} fill={p.cor ?? "currentColor"} opacity={p.opacidade} />
                ))}
                <g
                  className={`mapa-nucleo-grupo${hoverNucleo ? " hover" : ""}`}
                  style={{ transformOrigin: `${mapa.nucleo.nucleo[0]}px ${mapa.nucleo.nucleo[1]}px` } as CSSProperties}
                  onMouseEnter={() => setHoverNucleo(true)}
                  onMouseLeave={() => setHoverNucleo(false)}
                >
                  <circle className="mapa-nucleo" cx={mapa.nucleo.nucleo[0]} cy={mapa.nucleo.nucleo[1]} r={5.85} />
                  <circle cx={mapa.nucleo.satelite[0]} cy={mapa.nucleo.satelite[1]} r={4.4} fill="currentColor" />
                  {/* área de toque maior — o ponto visível é pequeno demais pra passar o mouse com precisão */}
                  <circle
                    cx={mapa.nucleo.nucleo[0]}
                    cy={mapa.nucleo.nucleo[1]}
                    r={34}
                    fill="transparent"
                    className="mapa-nucleo-alvo"
                  />
                </g>
              </g>

              {depts.map((x) => (
                <g
                  key={x.dept.id}
                  stroke={x.dept.cor}
                  className={`mapa-svg-dept${hoverId && hoverId !== x.dept.id ? " apagado" : ""}`}
                >
                  {x.ramos.map((r, k) => (
                    <g key={k}>
                      <path d={d(r.stub)} className="mapa-aresta tracejada" />
                      {r.arestas.map((a, j) => (
                        <path key={j} d={d(a)} className="mapa-aresta" />
                      ))}
                      <circle cx={r.juncao[0]} cy={r.juncao[1]} r={5} fill={x.dept.cor} stroke="none" opacity={0.9} />
                    </g>
                  ))}
                </g>
              ))}
            </svg>

            <div className={`mapa-nucleo-nome${hoverId ? " apagado" : ""}`}>
              {MAPA_NUCLEO.nome}
              <small>{MAPA_NUCLEO.sub}</small>
            </div>

            {depts.map((x) => {
              const Icon = x.dept.icon;
              const emFoco = x.dept.id === focoId;
              const emHover = x.dept.id === hoverId;
              return (
                <div
                  key={x.dept.id}
                  className={`mapa-dept${emFoco ? " foco" : ""}${emHover ? " hover" : ""}${
                    hoverId && !emHover ? " apagado" : ""
                  }`}
                  style={{ "--c": x.dept.cor } as CSSProperties}
                  onMouseEnter={() => setHoverId(x.dept.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <button
                    type="button"
                    className="mapa-badge"
                    style={at(x.badge)}
                    onClick={() => (emFoco && x.dept.to ? navigate(x.dept.to) : setFocoId(x.dept.id))}
                    aria-label={emFoco && x.dept.to ? `Abrir ${x.dept.nome}` : `Destacar ${x.dept.nome}`}
                    title={emFoco && x.dept.to ? `Abrir ${x.dept.nome}` : x.dept.nome}
                  >
                    <Icon strokeWidth={1.5} />
                  </button>

                  {x.ramos.flatMap((r) => r.pontos).map((p) => {
                    const hit = !!termo && semAcento(p.funcao.nome).includes(termo);
                    return (
                      <button
                        key={p.funcao.nome}
                        type="button"
                        className={`mapa-ponto ${p.funcao.status}${hit ? " hit" : ""}${p.funcao.to ? " link" : ""}`}
                        style={{ ...at(p.pos), animationDelay: `${p.delay.toFixed(2)}s` }}
                        aria-label={`${p.funcao.nome} — ${p.funcao.status === "ok" ? "em produção" : "em desenvolvimento"}`}
                        onClick={() => abrir(p.funcao)}
                        onMouseEnter={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setDica({ x: r.left + r.width / 2, y: r.top, funcao: p.funcao, dept: x.dept });
                        }}
                        onMouseLeave={() => setDica(null)}
                        onFocus={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setDica({ x: r.left + r.width / 2, y: r.top, funcao: p.funcao, dept: x.dept });
                        }}
                        onBlur={() => setDica(null)}
                      />
                    );
                  })}

                  <div className="mapa-rotulo" style={at(x.rotulo)}>
                    <div className="nm">{x.dept.nome}</div>
                    <div className="sb">{x.dept.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {anterior && (
          <button type="button" className="mapa-borda esq" onClick={() => irPara(-1)} aria-label={anterior.nome}>
            <ChevronLeft size={14} />
            <span>{anterior.nome}</span>
          </button>
        )}
        {proximo && (
          <button type="button" className="mapa-borda dir" onClick={() => irPara(1)} aria-label={proximo.nome}>
            <span>{proximo.nome}</span>
            <ChevronRight size={14} />
          </button>
        )}

        {foco && (
          <div className="mapa-foco">
            <button type="button" className="seta" style={{ left: "calc(50% - 215px)" }} onClick={() => irPara(-1)} aria-label="Departamento anterior">
              <ChevronLeft size={22} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="nome"
              onClick={() => foco.to && navigate(foco.to)}
              disabled={!foco.to}
              title={foco.to ? `Abrir ${foco.nome}` : undefined}
            >
              {foco.nome}
            </button>
            <button type="button" className="seta" style={{ right: "calc(50% - 215px)" }} onClick={() => irPara(1)} aria-label="Próximo departamento">
              <ChevronRight size={22} strokeWidth={1.5} />
            </button>
          </div>
        )}

        <div className="mapa-vidro mapa-legenda">
          <span><i />Em produção</span>
          <span><i className="vazado" />Em desenvolvimento</span>
        </div>

        <div className="mapa-vidro mapa-zoom">
          <button type="button" onClick={() => setZoom((z) => Math.max(z / 1.2, 0.5))} aria-label="Diminuir zoom">−</button>
          <span className="pct">{Math.round(escala * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(z * 1.2, 4))} aria-label="Aumentar zoom">+</button>
          <button type="button" className="ajustar" onClick={() => setZoom(ZOOM_PADRAO)}>Ajustar</button>
        </div>

        {dica && (
          <div className="mapa-dica" style={{ left: dica.x, top: dica.y }} role="tooltip">
            <b>{dica.funcao.nome}</b>
            <span className={`st ${dica.funcao.status}`}>
              {dica.funcao.status === "ok" ? "em produção" : "em desenvolvimento"}
            </span>
            <span className="meta">
              {dica.dept.nome}
              {dica.funcao.to ? " · clique para abrir" : dica.funcao.origem ? ` · roda em ${dica.funcao.origem}` : ""}
            </span>
          </div>
        )}
      </div>
    </Layout>
  );
}
