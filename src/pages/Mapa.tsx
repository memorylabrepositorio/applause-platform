import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

// troca entre carrossel e submenu: crossfade simples (fade + leve escala),
// sem zoom nem origem de clique — mesmo padrão usado em Radix/shadcn pra
// substituir conteúdo na tela
const TROCA: import("framer-motion").Transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] };

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
  const gradeRef = useRef<HTMLDivElement>(null);
  const arrastoRef = useRef<{ y: number; scroll: number } | null>(null);
  const arrastouRef = useRef(false);
  const [arrastando, setArrastando] = useState(false);

  const foco = depts[focoIdx];
  const funcoesFoco = useMemo(() => foco.ramos.flat(), [foco]);
  // setor com muitas funções vira grade de 2 colunas em vez de rolar
  const muitasFuncoes = funcoesFoco.length > 8;

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

  // a sidebar expande/recolhe com uma transição de largura (hover/pin) — o
  // Swiper não escuta esse tipo de redimensionamento do próprio contêiner
  // sozinho de forma confiável, então ele reobserva o tamanho aqui e força
  // o recálculo (update) sempre que a caixa do Mapa mudar de largura, pra
  // o carrossel nunca ficar centralizado com base numa medida antiga
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      swiperRef.current?.update();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const irPara = useCallback((passo: number) => {
    const sw = swiperRef.current;
    if (!sw) return;
    if (passo < 0) sw.slidePrev();
    else sw.slideNext();
  }, []);

  // abre um módulo de verdade — navega direto, sem efeito de saída; a
  // própria rota de destino já mostra o spinner de carregamento
  const abrir = useCallback(
    (e: React.MouseEvent<HTMLElement>, funcao: MapaFuncao) => {
      if (arrastouRef.current) {
        arrastouRef.current = false;
        return;
      }
      if (!funcao.to) return;
      navigate(funcao.to);
    },
    [navigate]
  );

  // abre o submenu do setor — troca de conteúdo com o crossfade padrão
  const abrirExpandido = useCallback(() => {
    setExpandido(true);
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
        setBusca("");
        navigate(achado.funcao.to);
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

  function cliqueCard(i: number) {
    if (i === focoIdx) abrirExpandido();
    else irParaDept(i);
  }

  return (
    <Layout>
      <div className="mapa" ref={boxRef}>
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
          <AnimatePresence mode="wait" initial={false}>
            {!expandido ? (
              <motion.div
                key="palco"
                className="mapa-palco"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={TROCA}
              >
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
                    spaceBetween={16}
                    coverflowEffect={{ rotate: 12, stretch: 6, depth: 70, modifier: 1, slideShadows: false }}
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
              </motion.div>
            ) : (
              <motion.div
                key="grade"
                className={`mapa-grade-caixa${arrastando ? " arrastando" : ""}${muitasFuncoes ? " colunas" : ""}`}
                ref={gradeRef}
                onMouseDown={onGradeMouseDown}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={TROCA}
              >
                {funcoesFoco.map((f) => (
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
