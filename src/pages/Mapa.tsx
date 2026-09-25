import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, X } from "lucide-react";
import Layout from "@/components/Layout";
import { DEPARTAMENTOS, MAPA_FOCO_INICIAL, MAPA_NUCLEO, type MapaDepartamento, type MapaFuncao } from "@/lib/mapa/data";
import { construirFoco, construirMapa, MAPA_EXTENSAO, type Pt } from "@/lib/mapa/layout";
import "./Mapa.css";

const at = (p: Pt): CSSProperties => ({ left: `${p[0].toFixed(2)}px`, top: `${p[1].toFixed(2)}px` });
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// zoom acima de 100% por padrão — o "ajuste" sozinho deixa o mapa cabendo
// certinho no espaço, mas pequeno; isso faz ele ocupar mais tela de cara
const ZOOM_PADRAO = 1.3;

export default function Mapa() {
  const navigate = useNavigate();
  const mapa = useMemo(() => construirMapa(DEPARTAMENTOS), []);
  const depts = mapa.depts;
  const total = useMemo(() => depts.reduce((n, x) => n + x.dept.ramos.flat().length, 0), [depts]);

  const [focoId, setFocoId] = useState(
    depts.some((x) => x.dept.id === MAPA_FOCO_INICIAL) ? MAPA_FOCO_INICIAL : depts[0]?.dept.id
  );
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState(0.3);
  const [zoom, setZoom] = useState(ZOOM_PADRAO);
  const [busca, setBusca] = useState("");
  const [telaCheia, setTelaCheia] = useState(false);
  // ao passar o mouse num departamento, os outros escurecem — só ele
  // (sinapse, rótulo) fica em destaque, tipo um "spotlight"
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverNucleo, setHoverNucleo] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // escala "Ajustar": cabe o mapa inteiro na área visível (já descontando o
  // painel lateral, que reduz a largura do viewport de verdade)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const medir = () =>
      setAjuste(
        Math.min(
          el.clientWidth / (el.clientWidth < 700 ? MAPA_EXTENSAO.largura * 0.82 : MAPA_EXTENSAO.largura),
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

  // setas do teclado trocam o departamento em destaque; Esc fecha a tela cheia
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;
      if (e.key === "Escape" && abertoId) { setAbertoId(null); return; }
      if (e.key === "ArrowLeft") irPara(-1);
      if (e.key === "ArrowRight") irPara(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [irPara, abertoId]);

  const termo = semAcento(busca.trim());
  const achados = useMemo(() => {
    if (!termo) return [] as MapaFuncao[];
    return depts.flatMap((x) => x.dept.ramos.flat()).filter((f) => semAcento(f.nome).includes(termo));
  }, [termo, depts]);

  function abrir(funcao: MapaFuncao) {
    if (funcao.to) { navigate(funcao.to); return; }
    const dono = depts.find((x) => x.dept.ramos.flat().includes(funcao));
    if (dono) { setFocoId(dono.dept.id); setAbertoId(dono.dept.id); }
  }

  function telaCheiaToggle() {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }

  const escala = ajuste * zoom;

  // setor em foco no painel lateral: acompanha o hover quando há um, senão
  // mostra o setor em destaque (o mesmo que o carrossel de baixo navega)
  const painelDept = (hoverId && depts.find((x) => x.dept.id === hoverId)?.dept) || foco;
  const deptAberto = abertoId ? depts.find((x) => x.dept.id === abertoId)?.dept : null;
  const funcoesAbertas = useMemo(() => (deptAberto ? deptAberto.ramos.flat() : []), [deptAberto]);
  const pontosFoco = useMemo(() => (funcoesAbertas.length ? construirFoco(funcoesAbertas) : []), [funcoesAbertas]);

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

        <div className="mapa-viewport" ref={viewportRef}>
          <div className="mapa-palco" style={{ transform: `translate(0px, 20px) scale(${escala})` }}>
            <svg className={`mapa-svg${hoverId ? " apagando" : ""}`} width={2640} height={2640} viewBox="-1320 -1320 2640 2640" aria-hidden="true">
              <defs>
                <filter id="mapa-glow" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="1" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {depts.map((x) => (
                <g
                  key={x.dept.id}
                  style={{ color: x.dept.cor }}
                  className={`mapa-svg-dept${hoverId && hoverId !== x.dept.id ? " apagado" : ""}`}
                >
                  <path d={x.sinapseIda} className="mapa-sinapse" />
                  <circle r={2.4} className="mapa-mote">
                    <animateMotion dur={`${x.mote.dur.toFixed(2)}s`} begin={`${x.mote.begin.toFixed(2)}s`} repeatCount="indefinite" path={x.sinapseIda} />
                  </circle>
                </g>
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
                <circle cx={mapa.nucleo.nucleo[0]} cy={mapa.nucleo.nucleo[1]} r={34} fill="transparent" className="mapa-nucleo-alvo" />
              </g>
            </svg>

            <div className={`mapa-nucleo-nome${hoverId ? " apagado" : ""}`}>
              {MAPA_NUCLEO.nome}
              <small>{MAPA_NUCLEO.sub}</small>
            </div>

            {depts.map((x) => {
              const Icon = x.dept.icon;
              const emFoco = x.dept.id === focoId;
              const emHover = x.dept.id === hoverId;
              const hit = !!termo && x.dept.ramos.flat().some((f) => semAcento(f.nome).includes(termo));
              return (
                <div
                  key={x.dept.id}
                  className={`mapa-dept${emFoco ? " foco" : ""}${emHover ? " hover" : ""}${
                    hoverId && !emHover ? " apagado" : ""
                  }${hit ? " hit" : ""}`}
                  style={{ "--c": x.dept.cor } as CSSProperties}
                  onMouseEnter={() => setHoverId(x.dept.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <button
                    type="button"
                    className="mapa-badge"
                    style={at(x.badge)}
                    onClick={() => {
                      if (emFoco) setAbertoId(x.dept.id);
                      else setFocoId(x.dept.id);
                    }}
                    aria-label={emFoco ? `Ver funções de ${x.dept.nome}` : `Destacar ${x.dept.nome}`}
                    title={emFoco ? `Ver funções de ${x.dept.nome}` : x.dept.nome}
                  >
                    <Icon strokeWidth={1.5} />
                  </button>
                  <div className="mapa-rotulo" style={at(x.rotulo)}>
                    {x.dept.nome}
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

        {painelDept && (
          <aside className="mapa-painel mapa-vidro" style={{ "--c": painelDept.cor } as CSSProperties}>
            <div className="mapa-painel-cab">
              <div className="mapa-painel-icone">
                <painelDept.icon strokeWidth={1.6} />
              </div>
              <div>
                <div className="mapa-painel-titulo">{painelDept.nome}</div>
                <div className="mapa-painel-sub">{painelDept.sub}</div>
              </div>
            </div>
            <div className="mapa-painel-lista">
              {painelDept.ramos.flat().map((f) => (
                <div key={f.nome} className="mapa-painel-item">
                  <span className={`ponto ${f.status}`} />
                  <span className="nome">{f.nome}</span>
                  {f.origem && <span className="origem">{f.origem}</span>}
                </div>
              ))}
            </div>
            <button type="button" className="mapa-painel-entrar" onClick={() => setAbertoId(painelDept.id)}>
              Entrar no setor →
            </button>
          </aside>
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

        {deptAberto && (
          <div className="mapa-aberto" style={{ "--c": deptAberto.cor } as CSSProperties}>
            <div className="mapa-aberto-topo">
              <div className="mapa-aberto-trilha">
                <button type="button" onClick={() => setAbertoId(null)}>Mapa geral</button>
                <ChevronRight size={12} />
                <b>{deptAberto.nome}</b>
              </div>
              <div className="mapa-aberto-acoes">
                {deptAberto.to && (
                  <button type="button" className="mapa-aberto-abrir" onClick={() => navigate(deptAberto.to!)}>
                    Abrir módulo →
                  </button>
                )}
                <button type="button" className="mapa-aberto-voltar" onClick={() => setAbertoId(null)}>
                  <X size={13} /> voltar pro mapa
                </button>
              </div>
            </div>

            <div className="mapa-aberto-centro">
              <svg className="mapa-aberto-svg" width={1600} height={1600} viewBox="-800 -800 1600 1600" aria-hidden="true">
                <g filter="url(#mapa-glow)" style={{ color: deptAberto.cor }}>
                  {pontosFoco.map((p, i) => (
                    <path key={i} d={p.curva} className="mapa-aberto-linha" />
                  ))}
                </g>
              </svg>

              <div className="mapa-aberto-nucleo">
                <deptAberto.icon strokeWidth={1.5} />
                <span>{deptAberto.nome}</span>
              </div>

              {pontosFoco.map((p) => (
                <button
                  key={p.funcao.nome}
                  type="button"
                  className={`mapa-aberto-func${p.funcao.to ? " link" : ""}`}
                  style={at(p.pos)}
                  onClick={() => p.funcao.to && navigate(p.funcao.to)}
                  disabled={!p.funcao.to}
                >
                  <span className="nome"><i className={`ponto ${p.funcao.status}`} />{p.funcao.nome}</span>
                  {p.funcao.origem && <span className="origem">{p.funcao.origem}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
