import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Pagination } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper/types";
import Layout from "@/components/Layout";
import { DEPARTAMENTOS, type MapaDepartamento, type MapaFuncao } from "@/lib/mapa/data";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "./Mapa.css";

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
  const boxRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<SwiperClass | null>(null);

  const foco = depts[focoIdx];

  useEffect(() => {
    const onFs = () => setTelaCheia(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const irPara = useCallback((passo: number) => {
    const sw = swiperRef.current;
    if (!sw) return;
    if (passo < 0) sw.slidePrev();
    else sw.slideNext();
  }, []);

  const abrir = useCallback(
    (funcao: MapaFuncao) => {
      if (funcao.to) navigate(funcao.to);
    },
    [navigate]
  );

  const irParaDept = useCallback((i: number, abrirDireto = false) => {
    const sw = swiperRef.current;
    if (sw) sw.slideToLoop(i);
    setFocoIdx(i);
    if (abrirDireto) setExpandido(true);
  }, []);

  const abrirDestaque = useCallback(
    (achado: Achado) => {
      const i = depts.findIndex((x) => x.id === achado.dept.id);
      if (i >= 0) irParaDept(i, true);
      setDestaque(achado.funcao.nome);
      setBusca("");
      if (achado.funcao.to) navigate(achado.funcao.to);
    },
    [depts, navigate, irParaDept]
  );

  // teclado: setas giram o carrossel; Esc fecha a grade expandida ou a busca
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

  function cliqueCard(i: number) {
    if (i === focoIdx) setExpandido(true);
    else irParaDept(i);
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
          {!expandido ? (
            <div className="mapa-carrossel-caixa">
              <div className="mapa-ambiente" style={{ "--c": foco.cor } as CSSProperties} />
              <Swiper
                modules={[EffectCoverflow, Pagination]}
                effect="coverflow"
                grabCursor
                centeredSlides
                loop
                slidesPerView="auto"
                coverflowEffect={{ rotate: 28, stretch: 0, depth: 140, modifier: 1, slideShadows: false }}
                pagination={{ clickable: true, el: ".mapa-pontinhos" }}
                onSwiper={(sw) => {
                  swiperRef.current = sw;
                  sw.slideToLoop(focoInicial, 0, false);
                }}
                onSlideChange={(sw) => setFocoIdx(sw.realIndex)}
                className="mapa-swiper"
              >
                {depts.map((d, i) => {
                  const Icon = d.icon;
                  return (
                    <SwiperSlide key={d.id} className="mapa-slide">
                      <button
                        type="button"
                        className={`mapa-card${i === focoIdx ? " ativo" : ""}`}
                        style={{ "--c": d.cor } as CSSProperties}
                        onClick={() => cliqueCard(i)}
                        aria-label={i === focoIdx ? `Abrir ${d.nome}` : `Focar ${d.nome}`}
                      >
                        <span className="mapa-card-icone">
                          <Icon strokeWidth={1.5} />
                        </span>
                        <span className="mapa-card-nome">{d.nome}</span>
                        <span className="mapa-card-sub">{d.sub}</span>
                      </button>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>
          ) : (
            <div className="mapa-grade-caixa">
              {foco.ramos.flat().map((f) => (
                <button
                  type="button"
                  key={f.nome}
                  className={`mapa-func${destaque === f.nome ? " destaque" : ""}${f.to ? " link" : ""}`}
                  style={{ "--c": foco.cor } as CSSProperties}
                  onClick={() => abrir(f)}
                >
                  <span className="n">
                    <i className={f.status === "dev" ? "dev" : ""} />
                    {f.nome}
                  </span>
                  {f.origem && <span className="o">{f.origem}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!expandido ? (
          <>
            <div className="mapa-setor-sub">
              <button type="button" onClick={() => setExpandido(true)}>
                {foco.nome}
              </button>
            </div>
            <div className="mapa-navs mapa-vidro">
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
            <div className="mapa-pontinhos" />
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
