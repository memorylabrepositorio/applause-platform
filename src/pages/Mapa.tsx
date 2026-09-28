import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { DEPARTAMENTOS, type MapaDepartamento, type MapaFuncao } from "@/lib/mapa/data";
import { construirAnel, construirFoco, INCLINACAO, REFERENCIA } from "@/lib/mapa/carrossel";
import "./Mapa.css";

const at = ([x, y]: [number, number]): CSSProperties => ({
  left: `calc(50% + ${x.toFixed(2)}px)`,
  top: `calc(50% + ${y.toFixed(2)}px)`,
});
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Achado {
  funcao: MapaFuncao;
  dept: MapaDepartamento;
}

// estrelas de fundo — geradas uma vez, fora do componente, pra não recalcular a cada render
const ESTRELAS = Array.from({ length: 110 }, (_, i) => {
  const rnd = (n: number) => ((Math.sin(i * 999 + n) + 1) / 2);
  return {
    left: rnd(1) * 100,
    top: rnd(2) * 100,
    size: rnd(3) < 0.25 ? 2 : 1,
    delay: rnd(4) * 6,
    dur: 4 + rnd(5) * 5,
  };
});

export default function Mapa() {
  const navigate = useNavigate();
  const depts = DEPARTAMENTOS;
  const total = useMemo(() => depts.reduce((n, x) => n + x.ramos.flat().length, 0), [depts]);

  const focoInicial = Math.max(0, depts.findIndex((x) => x.id === "comercial"));
  const [focoIdx, setFocoIdx] = useState(focoInicial);
  const [expandido, setExpandido] = useState(false);
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState<string | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [escala, setEscala] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);

  const foco = depts[focoIdx];
  const anel = useMemo(() => construirAnel(depts, focoIdx), [depts, focoIdx]);
  const focoLayout = useMemo(() => construirFoco(foco), [foco]);

  // encolhe (ou aumenta um pouco) a cena pra caber na área visível — mesmo
  // truque do mapa antigo, só que aplicado numa "moldura" de referência fixa
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const medir = () => {
      const s = Math.min(el.clientWidth / REFERENCIA.largura, el.clientHeight / REFERENCIA.altura);
      setEscala(Math.min(s, 1.2));
    };
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

  const irPara = useCallback(
    (passo: number) => setFocoIdx((i) => (i + passo + depts.length) % depts.length),
    [depts.length]
  );

  const abrir = useCallback(
    (funcao: MapaFuncao) => {
      if (funcao.to) navigate(funcao.to);
    },
    [navigate]
  );

  const abrirDestaque = useCallback(
    (achado: Achado) => {
      const i = depts.findIndex((x) => x.id === achado.dept.id);
      if (i >= 0) setFocoIdx(i);
      setExpandido(true);
      setDestaque(achado.funcao.nome);
      setBusca("");
      if (achado.funcao.to) navigate(achado.funcao.to);
    },
    [depts, navigate]
  );

  // teclado: setas giram o carrossel; Esc fecha a constelação expandida ou a busca
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const noCampo = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (e.key === "Escape") {
        if (expandido) setExpandido(false);
        else if (busca) setBusca("");
        return;
      }
      if (noCampo) return;
      if (e.key === "ArrowLeft" && !expandido) irPara(-1);
      if (e.key === "ArrowRight" && !expandido) irPara(1);
      if (e.key === "Enter" && !expandido) setExpandido(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [irPara, expandido, busca]);

  // o destaque de busca some sozinho depois de um tempo
  useEffect(() => {
    if (!destaque) return;
    const t = setTimeout(() => setDestaque(null), 3200);
    return () => clearTimeout(t);
  }, [destaque]);

  const termo = semAcento(busca.trim());
  const achados = useMemo<Achado[]>(() => {
    if (!termo) return [];
    return depts
      .flatMap((dept) => dept.ramos.flat().map((funcao) => ({ funcao, dept })))
      .filter((a) => semAcento(a.funcao.nome).includes(termo))
      .slice(0, 8);
  }, [termo, depts]);

  function telaCheiaToggle() {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }

  function cliqueEsfera(item: ReturnType<typeof construirAnel>[number]) {
    if (item.emFoco) setExpandido(true);
    else setFocoIdx(depts.findIndex((x) => x.id === item.dept.id));
  }

  return (
    <Layout>
      <div className="mapa" ref={boxRef}>
        <div className="mapa-estrelas" aria-hidden="true">
          {ESTRELAS.map((s, i) => (
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

          {!expandido ? (
            <>
              <div className="mapa-busca-caixa">
                <label className="mapa-vidro mapa-busca">
                  <Search size={15} />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && achados.length === 1) {
                        e.stopPropagation();
                        abrirDestaque(achados[0]);
                      }
                      if (e.key === "Escape") setBusca("");
                    }}
                    placeholder={`buscar ${total} funções · SDR, convites, Pronet, álbuns…`}
                    aria-label="Buscar funções no mapa"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {termo && <span className="mapa-busca-n">{achados.length}</span>}
                </label>
                {termo && (
                  <div className="mapa-busca-lista mapa-vidro">
                    {achados.length === 0 && <div className="mapa-busca-vazio">nada encontrado</div>}
                    {achados.map((a) => (
                      <button key={a.funcao.nome} type="button" onClick={() => abrirDestaque(a)}>
                        <i style={{ "--c": a.dept.cor } as CSSProperties} className={a.funcao.status} />
                        <span className="nm">{a.funcao.nome}</span>
                        <span className="dp">{a.dept.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="mapa-aba">MAPA</span>
            </>
          ) : (
            <>
              <div className="mapa-trilha mapa-vidro">
                <span className="pref">Mapa geral <ChevronRight size={12} /></span>
                <b style={{ color: foco.cor }}>{foco.nome}</b>
              </div>
              <button type="button" className="mapa-vidro mapa-voltar" onClick={() => setExpandido(false)}>
                <span className="txt">voltar pro carrossel</span>
                <span aria-hidden="true">×</span>
              </button>
            </>
          )}
        </div>

        <div className="mapa-viewport">
          <div className="mapa-quadro" style={{ transform: `scale(${escala})` }}>
            {!expandido ? (
              <div className="mapa-anel-caixa">
                <div className="mapa-anel" style={{ transform: `rotateX(${INCLINACAO}deg)` }}>
                  {anel.map((item) => {
                    const Icon = item.dept.icon;
                    return (
                      <button
                        type="button"
                        key={item.dept.id}
                        className={`mapa-esfera${item.emFoco ? " foco" : ""}`}
                        style={
                          {
                            "--c": item.dept.cor,
                            "--glow": item.emFoco ? "58%" : "16%",
                            transform: `translate3d(${item.x.toFixed(1)}px, 0, ${item.z.toFixed(1)}px) scale(${item.escala.toFixed(3)})`,
                            opacity: item.opacidade,
                            filter: item.blur ? `blur(${item.blur.toFixed(1)}px)` : undefined,
                            zIndex: item.zIndex,
                          } as CSSProperties
                        }
                        onClick={() => cliqueEsfera(item)}
                        aria-label={item.emFoco ? `Abrir ${item.dept.nome}` : `Destacar ${item.dept.nome}`}
                        title={item.emFoco ? `Abrir ${item.dept.nome}` : item.dept.nome}
                      >
                        <span className="halo" />
                        <span className="anel-fino" />
                        <span className="corpo" />
                        <span className="veu" />
                        <span className="rosto">
                          <Icon strokeWidth={1.5} />
                          <span className="nome">{item.dept.nome}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mapa-exp-caixa">
                <div className="mapa-exp-fundo" style={{ "--c": foco.cor } as CSSProperties} />
                <svg className="mapa-exp-svg" width={REFERENCIA.largura} height={REFERENCIA.altura} viewBox={`${-REFERENCIA.largura / 2} ${-REFERENCIA.altura / 2} ${REFERENCIA.largura} ${REFERENCIA.altura}`} aria-hidden="true">
                  {focoLayout.blocos.map((b, i) => (
                    <line key={i} x1={0} y1={0} x2={b.pos[0]} y2={b.pos[1]} stroke={foco.cor} strokeWidth={1.2} strokeOpacity={0.35} />
                  ))}
                </svg>

                <div className="mapa-exp-esfera" style={{ "--c": foco.cor } as CSSProperties}>
                  <span className="halo" />
                  <span className="corpo" />
                  <span className="veu" />
                  <span className="rosto">
                    <foco.icon strokeWidth={1.4} />
                    <span className="nome">{foco.nome}</span>
                  </span>
                </div>

                {focoLayout.blocos.map((b) => (
                  <button
                    type="button"
                    key={b.funcao.nome}
                    className={`mapa-bloco${destaque === b.funcao.nome ? " destaque" : ""}${b.funcao.to ? " link" : ""}`}
                    style={{ ...at(b.pos), "--c": foco.cor } as CSSProperties}
                    onClick={() => abrir(b.funcao)}
                  >
                    <span className="n">
                      <i className={b.funcao.status === "dev" ? "dev" : ""} />
                      {b.funcao.nome}
                    </span>
                    {b.funcao.origem && <span className="o">{b.funcao.origem}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!expandido ? (
          <>
            <div className="mapa-setor-sub">
              <button type="button" onClick={() => setExpandido(true)}>
                {foco.nome}
              </button>
            </div>
            <div className="mapa-navs">
              <button type="button" className="mapa-nav-btn" onClick={() => irPara(-1)} aria-label="Departamento anterior">
                <ChevronLeft size={17} strokeWidth={1.6} />
              </button>
              <button
                type="button"
                className="mapa-nav-btn ativo"
                style={{ "--c": foco.cor } as CSSProperties}
                onClick={() => setExpandido(true)}
                aria-label={`Abrir ${foco.nome}`}
              >
                <span className="ponto" />
              </button>
              <button type="button" className="mapa-nav-btn" onClick={() => irPara(1)} aria-label="Próximo departamento">
                <ChevronRight size={17} strokeWidth={1.6} />
              </button>
            </div>
            <div className="mapa-pontinhos">
              {depts.map((d, i) => (
                <button
                  type="button"
                  key={d.id}
                  className={i === focoIdx ? "on" : ""}
                  aria-label={d.nome}
                  onClick={() => setFocoIdx(i)}
                />
              ))}
            </div>
          </>
        ) : null}

        {!expandido && (
          <div className="mapa-vidro mapa-legenda">
            <span><i />Em produção</span>
            <span><i className="vazado" />Em desenvolvimento</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
