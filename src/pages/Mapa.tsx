import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper/types";
import Layout from "@/components/Layout";
import { DEPARTAMENTOS, type MapaDepartamento, type MapaFuncao } from "@/lib/mapa/data";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "./Mapa.css";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Achado {
  funcao: MapaFuncao;
  dept: MapaDepartamento;
}

// origem do zoom de saída, em % da caixa do Mapa — usado como transform-origin
interface Portal {
  ox: number;
  oy: number;
}

// duração do zoom de entrada num módulo
const PORTAL_MS = 420;

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
  const [portal, setPortal] = useState<Portal | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<SwiperClass | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const arrastoRef = useRef<{ y: number; scroll: number } | null>(null);
  const arrastouRef = useRef(false);
  const destinoRef = useRef<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const foco = depts[focoIdx];

  // trava o scroll da página enquanto o zoom de saída cresce, pra ele não
  // estourar o layout e abrir barra de rolagem por uma fração de segundo
  useEffect(() => {
    if (!portal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [portal]);

  // arrastar a lista do submenu com o mouse (além da roda/trackpad, que já
  // funciona nativamente por causa do overflow-y: auto)
  const onGradeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = gradeRef.current;
    if (!el) return;
    arrastoRef.current = { y: e.clientY, scroll: el.scrollTop };
    arrastouRef.current = false;
    setArrastando(true);
  }, []);

  useEffect(() => {
    if (!arrastando) return;
    function onMove(e: MouseEvent) {
      const el = gradeRef.current;
      const inicio = arrastoRef.current;
      if (!el || !inicio) return;
      const delta = e.clientY - inicio.y;
      if (Math.abs(delta) > 4) arrastouRef.current = true;
      el.scrollTop = inicio.scroll - delta;
    }
    function onUp() {
      setArrastando(false);
      arrastoRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [arrastando]);

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

  // ao abrir um módulo de verdade, o próprio Mapa dá um zoom gigante a partir
  // do ponto clicado e desaparece (fade) — só navega depois que ele sumiu
  const abrir = useCallback(
    (e: React.MouseEvent<HTMLElement>, funcao: MapaFuncao) => {
      if (arrastouRef.current) {
        arrastouRef.current = false;
        return;
      }
      if (!funcao.to) return;
      const caixa = boxRef.current?.getBoundingClientRect();
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      destinoRef.current = funcao.to;
      setPortal({
        ox: caixa ? ((cx - caixa.left) / caixa.width) * 100 : 50,
        oy: caixa ? ((cy - caixa.top) / caixa.height) * 100 : 50,
      });
      setTimeout(() => {
        if (destinoRef.current) navigate(destinoRef.current);
      }, PORTAL_MS);
    },
    [navigate]
  );

  // mesmo zoom de saída, mas pra abrir o submenu do setor (sem navegar pra
  // fora da página) — ao final, troca pra grade e volta a encolher, como se
  // estivesse "pousando" dentro do módulo
  const abrirExpandido = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const caixa = boxRef.current?.getBoundingClientRect();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPortal({
      ox: caixa ? ((cx - caixa.left) / caixa.width) * 100 : 50,
      oy: caixa ? ((cy - caixa.top) / caixa.height) * 100 : 50,
    });
    setTimeout(() => {
      setExpandido(true);
      setPortal(null);
    }, PORTAL_MS);
  }, []);

  const irParaDept = useCallback((i: number, abrirDireto = false) => {
    const sw = swiperRef.current;
    if (sw) sw.slideToLoop(i);
    setFocoIdx(i);
    if (abrirDireto) setExpandido(true);
  }, []);

  const abrirDestaque = useCallback(
    (e: React.MouseEvent<HTMLElement>, achado: Achado) => {
      if (achado.funcao.to) {
        // já é uma rota de verdade — mesmo zoom de saída usado na grade
        const caixa = boxRef.current?.getBoundingClientRect();
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        destinoRef.current = achado.funcao.to;
        setPortal({
          ox: caixa ? ((cx - caixa.left) / caixa.width) * 100 : 50,
          oy: caixa ? ((cy - caixa.top) / caixa.height) * 100 : 50,
        });
        setBusca("");
        setTimeout(() => {
          if (destinoRef.current) navigate(destinoRef.current);
        }, PORTAL_MS);
        return;
      }
      const i = depts.findIndex((x) => x.id === achado.dept.id);
      if (i >= 0) irParaDept(i, true);
      setDestaque(achado.funcao.nome);
      setBusca("");
    },
    [depts, irParaDept, navigate]
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

  function cliqueCard(e: React.MouseEvent<HTMLButtonElement>, i: number) {
    if (i === focoIdx) abrirExpandido(e);
    else irParaDept(i);
  }

  return (
    <Layout>
      <motion.div
        className="mapa"
        ref={boxRef}
        style={{ transformOrigin: portal ? `${portal.ox}% ${portal.oy}%` : "50% 50%" }}
        animate={{ opacity: portal ? 0 : 1, scale: portal ? 9 : 1 }}
        transition={{ duration: PORTAL_MS / 1000, ease: [0.64, 0, 0.78, 0] }}
      >
        <div className="mapa-topo">
          <button type="button" className="mapa-vidro mapa-btn" onClick={telaCheiaToggle} aria-label="Alternar tela cheia">
            {telaCheia ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {!expandido ? (
            <div className="mapa-busca-caixa">
              <label className="mapa-vidro mapa-busca">
                <Search size={15} />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && achados.length === 1) {
                      e.stopPropagation();
                      abrirDestaque(e as unknown as React.MouseEvent<HTMLElement>, achados[0]);
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
                    <button key={a.funcao.nome} type="button" onClick={(e) => abrirDestaque(e, a)}>
                      <i style={{ "--c": a.dept.cor } as CSSProperties} className={a.funcao.status} />
                      <span className="nm">{a.funcao.nome}</span>
                      <span className="dp">{a.dept.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <div className="mapa-palco">
              <div className="mapa-carrossel-caixa">
                <div className="mapa-ambiente" style={{ "--c": foco.cor } as CSSProperties} />
                <Swiper
                  modules={[EffectCoverflow]}
                  effect="coverflow"
                  grabCursor
                  centeredSlides
                  loop
                  speed={650}
                  slidesPerView="auto"
                  spaceBetween={30}
                  coverflowEffect={{ rotate: 18, stretch: 20, depth: 110, modifier: 1, slideShadows: false }}
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
                          onClick={(e) => cliqueCard(e, i)}
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

              <button type="button" className="mapa-setor-nome" onClick={abrirExpandido}>
                {foco.nome}
              </button>

              <div className="mapa-navs mapa-vidro">
                <button type="button" className="mapa-nav-btn" onClick={() => irPara(-1)} aria-label="Departamento anterior">
                  <ChevronLeft size={17} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  className="mapa-nav-btn ativo"
                  style={{ "--c": foco.cor } as CSSProperties}
                  onClick={abrirExpandido}
                  aria-label={`Abrir ${foco.nome}`}
                >
                  <span className="ponto" />
                </button>
                <button type="button" className="mapa-nav-btn" onClick={() => irPara(1)} aria-label="Próximo departamento">
                  <ChevronRight size={17} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`mapa-grade-caixa${arrastando ? " arrastando" : ""}`}
              ref={gradeRef}
              onMouseDown={onGradeMouseDown}
            >
              {foco.ramos.flat().map((f) => (
                <button
                  type="button"
                  key={f.nome}
                  className={`mapa-func${destaque === f.nome ? " destaque" : ""}${f.to ? " link" : ""}`}
                  style={{ "--c": foco.cor } as CSSProperties}
                  onClick={(e) => abrir(e, f)}
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

        {!expandido && (
          <div className="mapa-vidro mapa-legenda">
            <span><i />Em produção</span>
            <span><i className="vazado" />Em desenvolvimento</span>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
