import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Wallet,
  ShoppingBag,
  Receipt,
  Users,
  CalendarCheck2,
  Trophy,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";
import Layout from "@/components/Layout";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { CHART_NEUTRALS, categoricalPalette } from "@/lib/chartPalette";
import { loadVendasData } from "@/lib/vendas/fetch";
import {
  agendaStatus,
  applyFilters,
  comprouStatus,
  computeVendedorStats,
  estudioBreakdown,
  institutionBreakdown,
  institutionLabelOf,
  isUnmatchedRow,
  monthKey,
  monthlySeries,
  productBreakdown,
  titleCase,
  vendedorKey,
  vendedorLabel,
  type Filters,
  type VendaRow,
} from "@/lib/vendas/engine";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(v: number): string {
  return v.toLocaleString("pt-BR");
}
function fmtPct(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
function norm(s: string): string {
  return s.trim().toUpperCase();
}

type AlunosStatus = "" | "comprou" | "naocomprou" | "agendado" | "naoagendado";

export default function Vendas() {
  const { theme } = useTheme();
  const neutros = CHART_NEUTRALS[theme];
  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ year: String(new Date().getFullYear()) });
  const [alunosStatus, setAlunosStatus] = useState<AlunosStatus>("");
  const [alunosFilter, setAlunosFilter] = useState("");
  const [unmatchedFilter, setUnmatchedFilter] = useState("");
  // popovers flutuantes de detalhamento — ancorados no ponto clicado, não
  // um modal grande cobrindo a tela
  const [productPopover, setProductPopover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [monthPopover, setMonthPopover] = useState<{ key: string; x: number; y: number } | null>(null);
  const [vendedorPopover, setVendedorPopover] = useState<{ key: string; x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    loadVendasData()
      .then(setRows)
      .catch((e) => setError(e.message || "Falha ao carregar dados"));
  }, []);

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);
  // "não comprou" é uma linha sintética (aluno com contrato, sem venda) — não
  // entra em faturamento/ranking/gráfico, só no card de alunos
  const salesOnly = useMemo(() => filtered.filter((r) => r.descricao !== "NAO COMPROU"), [filtered]);

  const kpis = useMemo(() => {
    const totalRevenue = salesOnly.reduce((s, r) => s + r.total, 0);
    const itemCount = salesOnly.length;
    const ticketMedio = itemCount ? totalRevenue / itemCount : 0;
    const cpfSet = new Set(salesOnly.map((r) => (r.cpf ? `cpf:${r.cpf}` : `nome:${r.cliente.toUpperCase()}`)));
    const matched = salesOnly.filter((r) => r.status !== "NAO ENCONTRADO").length;
    const convRate = itemCount ? (matched / itemCount) * 100 : 0;
    return { totalRevenue, itemCount, ticketMedio, clientCount: cpfSet.size, convRate };
  }, [salesOnly]);

  // base pro gráfico mensal e pra projeção: ignora o filtro de mês (mas
  // respeita ano/estúdio/vendedor) — senão, ao selecionar um mês, sobra só
  // ele com dado e todo o resto zera, e a projeção fica sem base de cálculo
  const salesForTrend = useMemo(
    () => (rows ? applyFilters(rows, filters, "month").filter((r) => r.descricao !== "NAO COMPROU") : []),
    [rows, filters]
  );
  const monthly = useMemo(() => monthlySeries(salesForTrend, filters.year), [salesForTrend, filters.year]);
  const vendedores = useMemo(
    () => computeVendedorStats(salesOnly).sort((a, b) => b.revenue - a.revenue),
    [salesOnly]
  );
  const estudios = useMemo(() => estudioBreakdown(salesOnly).slice(0, 8), [salesOnly]);
  const instituicoes = useMemo(() => institutionBreakdown(salesOnly), [salesOnly]);
  const produtos = useMemo(() => productBreakdown(salesOnly), [salesOnly]);
  const palette = useMemo(() => categoricalPalette(theme), [theme]);

  const topVendedor = vendedores[0] || null;
  const bottomVendedor = useMemo(() => {
    const comVenda = vendedores.filter((v) => v.revenue > 0);
    return comVenda.length > 1 ? comVenda[comVenda.length - 1] : null;
  }, [vendedores]);

  // projeção simples de faturamento (regressão linear sobre os últimos meses
  // com venda) — dá previsibilidade sem depender de uma API externa
  const projection = useMemo(() => {
    const withData = monthly.filter((m) => m.revenue > 0);
    if (withData.length < 2) return null;
    const pts = withData.slice(-6);
    const n = pts.length;
    const xMean = (n - 1) / 2;
    const yMean = pts.reduce((s, m) => s + m.revenue, 0) / n;
    let num = 0,
      den = 0;
    pts.forEach((m, i) => {
      num += (i - xMean) * (m.revenue - yMean);
      den += (i - xMean) ** 2;
    });
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const next = Math.max(0, intercept + slope * n);
    const trendPct = yMean ? (slope / yMean) * 100 : 0;
    const last = withData[withData.length - 1];
    const prev = withData[withData.length - 2];
    const momPct = prev && prev.revenue ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : null;
    const best = pts.reduce((a, b) => (b.revenue > a.revenue ? b : a));
    const worst = pts.reduce((a, b) => (b.revenue < a.revenue ? b : a));
    return { next, trendPct, basedOn: n, momPct, lastLabel: last.label, best, worst };
  }, [monthly]);

  // detalhamento por produto (usado no gráfico de pizza clicável)
  const productDetails = useMemo(() => {
    const map: Record<
      string,
      { revenue: number; units: number; vendedores: Record<string, number>; clientes: Record<string, number> }
    > = {};
    salesOnly.forEach((r) => {
      const pk = r.descricao?.trim() ? titleCase(r.descricao) : "Não informado";
      if (!map[pk]) map[pk] = { revenue: 0, units: 0, vendedores: {}, clientes: {} };
      map[pk].revenue += r.total;
      map[pk].units += 1;
      const vk = vendedorLabel(r);
      map[pk].vendedores[vk] = (map[pk].vendedores[vk] || 0) + r.total;
      const ck = titleCase(r.cliente);
      map[pk].clientes[ck] = (map[pk].clientes[ck] || 0) + r.total;
    });
    return map;
  }, [salesOnly]);

  const selectedProductDetail = useMemo(() => {
    if (!productPopover) return null;
    const d = productDetails[productPopover.label];
    if (!d) return null;
    return {
      label: productPopover.label,
      revenue: d.revenue,
      units: d.units,
      ticket: d.units ? d.revenue / d.units : 0,
      topVendedores: Object.entries(d.vendedores).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topClientes: Object.entries(d.clientes).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [productPopover, productDetails]);

  // detalhamento por mês (mesmo esquema do produto, aplicado ao gráfico
  // mensal) — usa a base sem filtro de mês, senão o mês clicado que não é o
  // filtrado no momento fica sem dado nenhum
  const monthDetails = useMemo(() => {
    const map: Record<
      string,
      { revenue: number; items: number; vendedores: Record<string, number>; produtos: Record<string, number> }
    > = {};
    salesForTrend.forEach((r) => {
      const mk = monthKey(r.dataVenda);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, items: 0, vendedores: {}, produtos: {} };
      map[mk].revenue += r.total;
      map[mk].items += 1;
      const vk = vendedorLabel(r);
      map[mk].vendedores[vk] = (map[mk].vendedores[vk] || 0) + r.total;
      const pk = r.descricao?.trim() ? titleCase(r.descricao) : "Não informado";
      map[mk].produtos[pk] = (map[mk].produtos[pk] || 0) + r.total;
    });
    return map;
  }, [salesForTrend]);

  const selectedMonthDetail = useMemo(() => {
    if (!monthPopover) return null;
    const d = monthDetails[monthPopover.key];
    const label = monthly.find((m) => m.key === monthPopover.key)?.label || monthPopover.key;
    if (!d) return { label, revenue: 0, items: 0, topVendedores: [] as [string, number][], topProdutos: [] as [string, number][] };
    return {
      label,
      revenue: d.revenue,
      items: d.items,
      topVendedores: Object.entries(d.vendedores).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topProdutos: Object.entries(d.produtos).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [monthPopover, monthDetails, monthly]);

  // detalhamento por vendedor (usado nos cards de destaque/menor volume)
  const vendedorProdutosMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    salesOnly.forEach((r) => {
      const vk = vendedorKey(r);
      if (!vk) return;
      if (!map[vk]) map[vk] = {};
      const pk = r.descricao?.trim() ? titleCase(r.descricao) : "Não informado";
      map[vk][pk] = (map[vk][pk] || 0) + r.total;
    });
    return map;
  }, [salesOnly]);

  const selectedVendedorDetail = useMemo(() => {
    if (!vendedorPopover) return null;
    const stats = vendedores.find((v) => v.key === vendedorPopover.key);
    if (!stats) return null;
    const prod = vendedorProdutosMap[vendedorPopover.key] || {};
    return {
      ...stats,
      topProdutos: Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [vendedorPopover, vendedores, vendedorProdutosMap]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Indicador", "Valor"],
        ["Faturamento total", kpis.totalRevenue],
        ["Itens vendidos", kpis.itemCount],
        ["Ticket médio", kpis.ticketMedio],
        ["Clientes únicos", kpis.clientCount],
        ["Cruzamento c/ agenda (%)", Number(kpis.convRate.toFixed(1))],
      ]),
      "Resumo"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Mês", "Faturamento", "Itens"], ...monthly.map((m) => [m.label, m.revenue, m.items])]),
      "Mensal"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Vendedor", "Faturamento", "Itens", "Conversão (%)"],
        ...vendedores.map((v) => [v.label, v.revenue, v.items, Number(v.conv.toFixed(1))]),
      ]),
      "Vendedores"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Produto", "Faturamento"], ...produtos.map((p) => [p.label, p.value])]),
      "Produtos"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Data", "Vendedor", "Cliente", "Estúdio", "Produto", "Total"],
        ...salesOnly.map((r) => [
          r.dataVenda,
          vendedorLabel(r),
          titleCase(r.cliente),
          titleCase(r.estudio),
          titleCase(r.descricao),
          r.total,
        ]),
      ]),
      "Vendas"
    );
    const suffix = filters.year ? `_${filters.year}${filters.month ? "-" + filters.month : ""}` : "";
    XLSX.writeFile(wb, `relatorio-vendas${suffix}.xlsx`);
  }

  async function exportPPTX() {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";

    const DARK = "0B0B0D";
    const CARD = "17171B";
    const BORDER = "232326";
    const MUTED = "8A8A94";
    const TEXT = "E8E8EC";
    const BRAND = "4A9ADE";

    const periodoLabel = filters.year
      ? `${filters.year}${filters.month ? " · " + (MESES_OPT.find(([v]) => v === filters.month)?.[1] || "") : ""}`
      : "Todos os períodos";

    // 1. capa
    let slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Painel de Vendas", { x: 0.6, y: 2.7, w: 12, h: 1, fontSize: 40, bold: true, color: "FFFFFF" });
    slide.addText(`${periodoLabel} · Applause Formaturas`, {
      x: 0.6,
      y: 3.6,
      w: 12,
      h: 0.5,
      fontSize: 18,
      color: BRAND,
    });
    slide.addText(`Relatório gerado em ${new Date().toLocaleDateString("pt-BR")}`, {
      x: 0.6,
      y: 6.9,
      w: 8,
      h: 0.4,
      fontSize: 11,
      color: MUTED,
    });

    // 2. resumo executivo
    slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Resumo executivo", { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 26, bold: true, color: "FFFFFF" });
    const kpiItems: [string, string][] = [
      ["Faturamento total", fmtBRL(kpis.totalRevenue)],
      ["Itens vendidos", fmtInt(kpis.itemCount)],
      ["Ticket médio", fmtBRL(kpis.ticketMedio)],
      ["Clientes únicos", fmtInt(kpis.clientCount)],
      ["Cruzamento c/ agenda", fmtPct(kpis.convRate)],
    ];
    kpiItems.forEach(([label, value], i) => {
      const x = 0.5 + (i % 3) * 4.15;
      const y = 1.35 + Math.floor(i / 3) * 2;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 3.9,
        h: 1.75,
        fill: { color: CARD },
        line: { color: BORDER, width: 1 },
        rectRadius: 0.08,
      });
      slide.addText(label.toUpperCase(), { x: x + 0.25, y: y + 0.2, w: 3.4, h: 0.4, fontSize: 11, color: MUTED });
      slide.addText(value, { x: x + 0.25, y: y + 0.6, w: 3.4, h: 0.8, fontSize: 22, bold: true, color: "FFFFFF" });
    });
    if (projection) {
      slide.addText(
        `Projeção pro próximo mês: ${fmtBRL(projection.next)} · tendência de ${
          projection.trendPct >= 0 ? "+" : ""
        }${projection.trendPct.toFixed(1)}% ao mês`,
        { x: 0.5, y: 5.7, w: 12, h: 0.5, fontSize: 14, color: BRAND, italic: true }
      );
    }

    // 3. faturamento mensal
    slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Faturamento por mês", { x: 0.5, y: 0.35, w: 12, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF" });
    slide.addChart(
      pptx.ChartType.bar,
      [{ name: "Faturamento", labels: monthly.map((m) => m.label), values: monthly.map((m) => m.revenue) }],
      {
        x: 0.5,
        y: 1.1,
        w: 12.3,
        h: 5.6,
        chartColors: [BRAND],
        showLegend: false,
        showValue: false,
        catAxisLabelColor: MUTED,
        valAxisLabelColor: MUTED,
        catAxisLineColor: BORDER,
        valAxisLineColor: BORDER,
        plotArea: { fill: { color: DARK } },
        chartArea: { fill: { color: DARK } },
      }
    );

    // 4. ranking de vendedores
    slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Vendas por vendedor", { x: 0.5, y: 0.35, w: 12, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF" });
    const headOpts = { bold: true, color: MUTED, fontSize: 11, fill: { color: CARD } };
    const bodyOpts = { color: TEXT, fontSize: 13, fill: { color: DARK } };
    const tableRows = [
      [
        { text: "Vendedor", options: headOpts },
        { text: "Faturamento", options: headOpts },
        { text: "Itens", options: headOpts },
        { text: "Conversão", options: headOpts },
      ],
      ...vendedores.slice(0, 12).map((v) => [
        { text: v.label, options: bodyOpts },
        { text: fmtBRL(v.revenue), options: bodyOpts },
        { text: fmtInt(v.items), options: bodyOpts },
        { text: fmtPct(v.conv), options: bodyOpts },
      ]),
    ];
    slide.addTable(tableRows, {
      x: 0.5,
      y: 1.15,
      w: 12.3,
      fontSize: 13,
      border: { type: "solid", color: BORDER, pt: 0.5 },
      autoPage: false,
    });

    // 5. mix de produtos
    slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Faturamento por produto", {
      x: 0.5,
      y: 0.35,
      w: 12,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: "FFFFFF",
    });
    slide.addChart(
      pptx.ChartType.pie,
      [{ name: "Produtos", labels: produtos.map((p) => p.label), values: produtos.map((p) => p.value) }],
      {
        x: 2.4,
        y: 1.05,
        w: 8.5,
        h: 5.7,
        chartColors: palette.map((c) => c.replace("#", "")),
        showLegend: true,
        legendPos: "b",
        legendColor: MUTED,
        dataLabelColor: "FFFFFF",
        showPercent: true,
        showValue: false,
      }
    );

    // 6. projeção e destaques
    slide = pptx.addSlide();
    slide.background = { color: DARK };
    slide.addText("Projeção e destaques", { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 26, bold: true, color: "FFFFFF" });
    const bullets: string[] = [];
    if (projection) {
      bullets.push(
        `Projeção pro próximo mês: ${fmtBRL(projection.next)} (tendência de ${
          projection.trendPct >= 0 ? "+" : ""
        }${projection.trendPct.toFixed(1)}% ao mês, com base nos últimos ${projection.basedOn} meses)`
      );
    }
    if (topVendedor) bullets.push(`Vendedor destaque: ${topVendedor.label} — ${fmtBRL(topVendedor.revenue)} em ${fmtInt(topVendedor.items)} itens`);
    if (bottomVendedor) bullets.push(`Menor volume: ${bottomVendedor.label} — ${fmtBRL(bottomVendedor.revenue)} em ${fmtInt(bottomVendedor.items)} itens`);
    if (produtos[0]) bullets.push(`Produto mais vendido: ${produtos[0].label} (${fmtBRL(produtos[0].value)})`);
    slide.addText(
      bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      { x: 0.6, y: 1.3, w: 12, h: 4.5, fontSize: 16, color: TEXT, lineSpacing: 32 }
    );

    const suffix = filters.year ? `_${filters.year}${filters.month ? "-" + filters.month : ""}` : "";
    await pptx.writeFile({ fileName: `relatorio-vendas${suffix}.pptx` });
  }

  function exportCSV() {
    const header = ["Data", "Vendedor", "Cliente", "Estúdio", "Produto", "Total"];
    const lines = [header.join(";")].concat(
      salesOnly.map((r) =>
        [
          r.dataVenda,
          vendedorLabel(r),
          titleCase(r.cliente),
          titleCase(r.estudio),
          titleCase(r.descricao),
          r.total.toFixed(2).replace(".", ","),
        ].join(";")
      )
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas${filters.year ? "_" + filters.year : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const unmatched = useMemo(() => {
    const base = salesOnly.filter(isUnmatchedRow);
    const f = norm(unmatchedFilter);
    if (!f) return base;
    return base.filter(
      (r) => norm(r.cliente).includes(f) || vendedorLabel(r).toUpperCase().includes(f) || norm(r.cpf).includes(f)
    );
  }, [salesOnly, unmatchedFilter]);

  const alunosCounts = useMemo(() => {
    let comprou = 0,
      naoComprou = 0,
      agendado = 0,
      naoAgendado = 0;
    filtered.forEach((r) => {
      if (comprouStatus(r) === "sim") comprou++;
      else naoComprou++;
      if (agendaStatus(r) === "sim") agendado++;
      else naoAgendado++;
    });
    return { total: filtered.length, comprou, naoComprou, agendado, naoAgendado };
  }, [filtered]);

  const alunos = useMemo(() => {
    let base = filtered;
    if (alunosStatus === "comprou") base = base.filter((r) => comprouStatus(r) === "sim");
    else if (alunosStatus === "naocomprou") base = base.filter((r) => comprouStatus(r) === "nao");
    else if (alunosStatus === "agendado") base = base.filter((r) => agendaStatus(r) === "sim");
    else if (alunosStatus === "naoagendado") base = base.filter((r) => agendaStatus(r) === "nao");

    const f = norm(alunosFilter);
    if (!f) return base;
    return base.filter(
      (r) =>
        norm(r.cliente).includes(f) ||
        vendedorLabel(r).toUpperCase().includes(f) ||
        norm(institutionLabelOf(r) || "").includes(f)
    );
  }, [filtered, alunosStatus, alunosFilter]);

  // listas completas pros selects de filtro (não encolhem conforme os
  // próprios filtros são aplicados — mesmo padrão do painel antigo)
  const allSalesOnly = useMemo(
    () => (rows ? rows.filter((r) => r.descricao !== "NAO COMPROU") : []),
    [rows]
  );
  const allVendedores = useMemo(
    () => computeVendedorStats(allSalesOnly).sort((a, b) => a.label.localeCompare(b.label)),
    [allSalesOnly]
  );
  const allEstudios = useMemo(
    () => estudioBreakdown(allSalesOnly).sort((a, b) => a.label.localeCompare(b.label)),
    [allSalesOnly]
  );
  const MESES_OPT = [
    ["01", "Jan"], ["02", "Fev"], ["03", "Mar"], ["04", "Abr"], ["05", "Mai"], ["06", "Jun"],
    ["07", "Jul"], ["08", "Ago"], ["09", "Set"], ["10", "Out"], ["11", "Nov"], ["12", "Dez"],
  ];

  const years = useMemo(() => {
    if (!rows) return [];
    const set = new Set<string>();
    rows.forEach((r) => {
      const y = r.dataVenda.split("/")[2];
      if (y) set.add(y);
    });
    return Array.from(set).sort().reverse();
  }, [rows]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {error}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando vendas…
      </div>
    );
  }

  const hasActiveFilter = !!(filters.month || filters.estudio || filters.vendedor);

  return (
    <Layout>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Painel de Vendas</h1>
          <p className="text-sm text-ink-400">
            {fmtInt(salesOnly.length)} de {fmtInt(rows.filter((r) => r.descricao !== "NAO COMPROU").length)} vendas
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-ink-200 transition hover:border-brand-600 hover:text-brand-300"
          >
            <Download size={15} strokeWidth={1.75} />
            Exportar relatório
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-ink-700 bg-ink-850 shadow-xl">
                <button
                  onClick={() => {
                    exportPPTX();
                    setExportOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  Apresentação (.pptx)
                </button>
                <button
                  onClick={() => {
                    exportExcel();
                    setExportOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => {
                    exportCSV();
                    setExportOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  CSV (.csv)
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* filtros */}
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <FilterField label="Ano">
          <select
            value={filters.year || ""}
            onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value || undefined }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Mês">
          <select
            value={filters.month || ""}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value || undefined }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            {MESES_OPT.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Estúdio">
          <select
            value={filters.estudio || ""}
            onChange={(e) => setFilters((f) => ({ ...f, estudio: e.target.value || undefined }))}
            className="max-w-[14rem] rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            {allEstudios.map((e) => (
              <option key={e.label} value={e.label.toUpperCase()}>{e.label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Vendedor">
          <select
            value={filters.vendedor || ""}
            onChange={(e) => setFilters((f) => ({ ...f, vendedor: e.target.value || undefined }))}
            className="max-w-[14rem] rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            {allVendedores.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </FilterField>
        {hasActiveFilter && (
          <button
            onClick={() => setFilters((f) => ({ year: f.year }))}
            className="rounded-md border border-ink-600 px-2.5 py-1.5 text-sm text-ink-300 hover:border-brand-600 hover:text-brand-300"
          >
            Limpar filtros ✕
          </button>
        )}
      </div>
      {hasActiveFilter && (
        <p className="mb-4 text-xs text-ink-400">
          Mostrando {fmtInt(salesOnly.length)} vendas
          {filters.month ? ` · mês ${MESES_OPT.find(([v]) => v === filters.month)?.[1]}` : ""}
          {filters.estudio ? ` · estúdio ${filters.estudio}` : ""}
          {filters.vendedor ? ` · vendedor ${filters.vendedor}` : ""}
        </p>
      )}

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Faturamento total" value={fmtBRL(kpis.totalRevenue)} icon={Wallet} tone="brand" />
        <Kpi label="Itens vendidos" value={fmtInt(kpis.itemCount)} icon={ShoppingBag} tone="violet" />
        <Kpi label="Ticket médio" value={fmtBRL(kpis.ticketMedio)} icon={Receipt} tone="amber" />
        <Kpi label="Clientes únicos" value={fmtInt(kpis.clientCount)} icon={Users} tone="sky" />
        <Kpi label="Cruzamento c/ agenda" value={fmtPct(kpis.convRate)} icon={CalendarCheck2} tone="emerald" />
      </div>

      {/* central de planejamento — previsibilidade */}
      <div className="mb-3 rounded-xl border border-ink-800 bg-ink-850 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
            <Sparkles size={14} className="text-brand-400" /> Projeção e tendência
          </div>
          {projection && (
            <p
              className={`flex items-center gap-1 text-xs ${
                projection.trendPct >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {projection.trendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {fmtPct(Math.abs(projection.trendPct))} ao mês, em média (últimos {projection.basedOn} meses)
            </p>
          )}
        </div>
        {projection ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Projeção próx. mês" value={fmtBRL(projection.next)} />
            <MiniStat
              label={`Vs. ${projection.lastLabel}`}
              value={projection.momPct === null ? "—" : `${projection.momPct >= 0 ? "+" : ""}${projection.momPct.toFixed(1)}%`}
            />
            <MiniStat label="Melhor mês" value={`${projection.best.label} · ${fmtBRL(projection.best.revenue)}`} />
            <MiniStat label="Mês mais fraco" value={`${projection.worst.label} · ${fmtBRL(projection.worst.revenue)}`} />
          </div>
        ) : (
          <p className="text-sm text-ink-400">
            Ainda não há meses suficientes com venda no ano selecionado pra calcular uma tendência.
          </p>
        )}
      </div>

      {/* destaques de vendedores — clique pra ver o detalhamento */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={(e) =>
            topVendedor &&
            setVendedorPopover((p) => (p?.key === topVendedor.key ? null : { key: topVendedor.key, x: e.clientX, y: e.clientY }))
          }
          disabled={!topVendedor}
          className="rounded-xl border border-ink-800 bg-ink-850 p-3.5 text-left transition hover:border-emerald-700/60 disabled:cursor-default disabled:hover:border-ink-800"
        >
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
            <Trophy size={14} className="text-emerald-400" /> Vendedor destaque
          </div>
          {topVendedor ? (
            <>
              <p className="truncate text-lg font-semibold">{topVendedor.label}</p>
              <p className="mt-1 text-xs text-ink-400">
                {fmtBRL(topVendedor.revenue)} · {fmtInt(topVendedor.items)} itens · clique pra detalhar
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-400">Sem dados no período.</p>
          )}
        </button>
        <button
          type="button"
          onClick={(e) =>
            bottomVendedor &&
            setVendedorPopover((p) =>
              p?.key === bottomVendedor.key ? null : { key: bottomVendedor.key, x: e.clientX, y: e.clientY }
            )
          }
          disabled={!bottomVendedor}
          className="rounded-xl border border-ink-800 bg-ink-850 p-3.5 text-left transition hover:border-amber-700/60 disabled:cursor-default disabled:hover:border-ink-800"
        >
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
            <TrendingDown size={14} className="text-amber-400" /> Menor volume
          </div>
          {bottomVendedor ? (
            <>
              <p className="truncate text-lg font-semibold">{bottomVendedor.label}</p>
              <p className="mt-1 text-xs text-ink-400">
                {fmtBRL(bottomVendedor.revenue)} · {fmtInt(bottomVendedor.items)} itens · clique pra detalhar
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-400">Sem dados no período.</p>
          )}
        </button>
      </div>

      {/* faturamento mensal */}
      <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-100">Faturamento por mês</p>
          <p className="text-xs text-ink-400">Clique numa barra pra filtrar e ver o detalhamento</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly}>
            <defs>
              <linearGradient id="vendasMesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0464b0" stopOpacity={1} />
                <stop offset="100%" stopColor="#0464b0" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id="vendasMesGradientDim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0464b0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0464b0" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={neutros.grid} />
            <XAxis dataKey="label" stroke={neutros.axis} fontSize={12} />
            <YAxis stroke={neutros.axis} fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              cursor={false}
              labelFormatter={(label: string) => `Mês de ${label}`}
              formatter={(v: number) => [fmtBRL(v), "Faturamento"]}
              labelStyle={{ color: neutros.tooltipText, fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: neutros.tooltipText }}
              contentStyle={{
                background: neutros.tooltipBg,
                border: `1px solid ${neutros.grid}`,
                borderRadius: 8,
                color: neutros.tooltipText,
                padding: "8px 12px",
              }}
            />
            <Bar
              dataKey="revenue"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
              onClick={(d: { key: string }, _i: number, e: React.MouseEvent) => {
                const month = d.key.split("-")[1];
                setFilters((f) => ({ ...f, month: f.month === month ? undefined : month }));
                setMonthPopover((p) => (p?.key === d.key ? null : { key: d.key, x: e.clientX, y: e.clientY }));
              }}
            >
              {monthly.map((m) => {
                const mk = m.key.split("-")[1];
                const dimmed = filters.month && filters.month !== mk;
                return (
                  <Cell key={m.key} fill={dimmed ? "url(#vendasMesGradientDim)" : "url(#vendasMesGradient)"} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ranking vendedores */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">Vendas por vendedor</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                <th className="py-2">Vendedor</th>
                <th className="py-2 text-right">Faturamento</th>
                <th className="py-2 text-right">Itens</th>
                <th className="py-2 text-right">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr
                  key={v.key}
                  onClick={() => setFilters((f) => ({ ...f, vendedor: v.key }))}
                  className="cursor-pointer border-b border-ink-800/50 hover:bg-ink-800/50"
                >
                  <td className="py-2">{v.label}</td>
                  <td className="py-2 text-right">{fmtBRL(v.revenue)}</td>
                  <td className="py-2 text-right">{fmtInt(v.items)}</td>
                  <td className="py-2 text-right">{fmtPct(v.conv)}</td>
                </tr>
              ))}
              {!vendedores.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-ink-400">
                    Sem vendas no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* estúdios */}
        <BarListCard
          title="Faturamento por estúdio"
          items={estudios}
          onClick={(label) => setFilters((f) => ({ ...f, estudio: label.toUpperCase() }))}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarListCard title="Faturamento por instituição" items={instituicoes} />

        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-100">Faturamento por produto</p>
            <p className="text-xs text-ink-400">Clique numa fatia pra ver detalhes</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={produtos}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="46%"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                isAnimationActive
                animationDuration={700}
                onClick={(d: { label?: string }, _i: number, e: React.MouseEvent) => {
                  if (!d.label || d.label === "Outros") return;
                  const label = d.label;
                  setProductPopover((p) => (p?.label === label ? null : { label, x: e.clientX, y: e.clientY }));
                }}
              >
                {produtos.map((p, i) => (
                  <Cell
                    key={p.label}
                    fill={palette[i % palette.length]}
                    stroke={neutros.tooltipBg}
                    strokeWidth={2}
                    opacity={p.label === "Outros" ? 0.55 : 1}
                    cursor={p.label === "Outros" ? "default" : "pointer"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n: string, entry: { payload?: { label?: string } }) => [
                  fmtBRL(v),
                  entry?.payload?.label || "",
                ]}
                labelFormatter={() => ""}
                itemStyle={{ color: neutros.tooltipText }}
                contentStyle={{
                  background: neutros.tooltipBg,
                  border: `1px solid ${neutros.grid}`,
                  borderRadius: 8,
                  color: neutros.tooltipText,
                  padding: "8px 12px",
                }}
              />
              <Legend verticalAlign="bottom" height={44} wrapperStyle={{ fontSize: 12, color: neutros.axis }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* alunos: comprou/não comprou, agendado/não agendado */}
      <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-100">
            Alunos ({fmtInt(alunos.length)} de {fmtInt(filtered.length)})
          </p>
          <input
            value={alunosFilter}
            onChange={(e) => setAlunosFilter(e.target.value)}
            placeholder="Buscar aluno, vendedor, instituição…"
            className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Pill active={alunosStatus === ""} onClick={() => setAlunosStatus("")}>
            Todos ({fmtInt(alunosCounts.total)})
          </Pill>
          <Pill active={alunosStatus === "comprou"} onClick={() => setAlunosStatus("comprou")}>
            Comprou ({fmtInt(alunosCounts.comprou)})
          </Pill>
          <Pill active={alunosStatus === "naocomprou"} onClick={() => setAlunosStatus("naocomprou")}>
            Não comprou ({fmtInt(alunosCounts.naoComprou)})
          </Pill>
          <Pill active={alunosStatus === "agendado"} onClick={() => setAlunosStatus("agendado")}>
            Agendado ({fmtInt(alunosCounts.agendado)})
          </Pill>
          <Pill active={alunosStatus === "naoagendado"} onClick={() => setAlunosStatus("naoagendado")}>
            Falta agendar ({fmtInt(alunosCounts.naoAgendado)})
          </Pill>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 bg-ink-850">
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                <th className="whitespace-nowrap py-2.5 pr-3">Data</th>
                <th className="py-2.5 pr-3">Aluno</th>
                <th className="py-2.5 pr-3">Instituição/Turma</th>
                <th className="py-2.5 pr-3">Produto</th>
                <th className="whitespace-nowrap py-2.5 pr-3 text-right">Total</th>
                <th className="whitespace-nowrap py-2.5 pr-3">Compra</th>
                <th className="whitespace-nowrap py-2.5">Agenda</th>
              </tr>
            </thead>
            <tbody>
              {alunos.slice(0, 300).map((r, i) => {
                const comprou = comprouStatus(r) === "sim";
                const agendou = agendaStatus(r) === "sim";
                const inst = institutionLabelOf(r);
                return (
                  <tr key={i} className="border-b border-ink-800/50">
                    <td className="whitespace-nowrap py-2.5 pr-3">{r.dataVenda || "—"}</td>
                    <td className="py-2.5 pr-3">{titleCase(r.cliente)}</td>
                    <td className="py-2.5 pr-3">{inst ? titleCase(inst) : "—"}</td>
                    <td className="py-2.5 pr-3">{titleCase(r.descricao)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right">{fmtBRL(r.total)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      <Badge good={comprou}>{comprou ? "Comprou" : "Não comprou"}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-2.5">
                      <Badge good={agendou}>{agendou ? "Agendado" : "Falta agendar"}</Badge>
                    </td>
                  </tr>
                );
              })}
              {!alunos.length && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-ink-400">Nenhum resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* vendas sem sessão na agenda */}
      <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-100">
            Vendas sem sessão na agenda ({fmtInt(unmatched.length)})
          </p>
          <input
            value={unmatchedFilter}
            onChange={(e) => setUnmatchedFilter(e.target.value)}
            placeholder="Buscar cliente, vendedor, CPF…"
            className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-850">
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                <th className="py-2">Data venda</th>
                <th className="py-2">Vendedor</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">CPF/CNPJ</th>
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.slice(0, 300).map((r, i) => (
                <tr key={i} className="border-b border-ink-800/50">
                  <td className="py-2">{r.dataVenda}</td>
                  <td className="py-2">{vendedorLabel(r)}</td>
                  <td className="py-2">{titleCase(r.cliente)}</td>
                  <td className="py-2">{r.cpf}</td>
                  <td className="py-2">{titleCase(r.descricao)}</td>
                  <td className="py-2 text-right">{fmtBRL(r.total)}</td>
                </tr>
              ))}
              {!unmatched.length && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-ink-400">Nenhum resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProductDetail && productPopover && (
        <DetailPopover anchor={productPopover} title={selectedProductDetail.label} onClose={() => setProductPopover(null)}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <MiniStat label="Faturamento" value={fmtBRL(selectedProductDetail.revenue)} />
            <MiniStat label="Unidades" value={fmtInt(selectedProductDetail.units)} />
            <MiniStat label="Ticket médio" value={fmtBRL(selectedProductDetail.ticket)} />
          </div>
          <div className="space-y-3">
            <TopList title="Top vendedores" entries={selectedProductDetail.topVendedores} />
            <TopList title="Top clientes" entries={selectedProductDetail.topClientes} />
          </div>
        </DetailPopover>
      )}

      {selectedMonthDetail && monthPopover && (
        <DetailPopover anchor={monthPopover} title={`Detalhamento — ${selectedMonthDetail.label}`} onClose={() => setMonthPopover(null)}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <MiniStat label="Faturamento" value={fmtBRL(selectedMonthDetail.revenue)} />
            <MiniStat label="Itens vendidos" value={fmtInt(selectedMonthDetail.items)} />
          </div>
          <div className="space-y-3">
            <TopList title="Top vendedores" entries={selectedMonthDetail.topVendedores} />
            <TopList title="Top produtos" entries={selectedMonthDetail.topProdutos} />
          </div>
        </DetailPopover>
      )}

      {selectedVendedorDetail && vendedorPopover && (
        <DetailPopover anchor={vendedorPopover} title={selectedVendedorDetail.label} onClose={() => setVendedorPopover(null)}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <MiniStat label="Faturamento" value={fmtBRL(selectedVendedorDetail.revenue)} />
            <MiniStat label="Itens" value={fmtInt(selectedVendedorDetail.items)} />
            <MiniStat label="Ticket médio" value={fmtBRL(selectedVendedorDetail.ticket)} />
            <MiniStat label="Conversão" value={fmtPct(selectedVendedorDetail.conv)} />
          </div>
          <TopList title="Top produtos vendidos" entries={selectedVendedorDetail.topProdutos} />
        </DetailPopover>
      )}
    </Layout>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink-400">{label}</label>
      {children}
    </div>
  );
}

const KPI_TONES = {
  brand: "from-brand-600/20 to-brand-600/5 text-brand-300",
  emerald: "from-emerald-600/20 to-emerald-600/5 text-emerald-300",
  violet: "from-violet-600/20 to-violet-600/5 text-violet-300",
  amber: "from-amber-600/20 to-amber-600/5 text-amber-300",
  sky: "from-sky-600/20 to-sky-600/5 text-sky-300",
} as const;

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof KPI_TONES;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-ink-800 bg-ink-850 p-3.5 transition-all duration-150 hover:border-ink-700">
      <div
        className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br opacity-70 blur-xl transition-opacity duration-200 group-hover:opacity-100 ${KPI_TONES[tone]}`}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-ink-400">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${KPI_TONES[tone]}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>
      </div>
    </div>
  );
}

function BarListCard({
  title,
  items,
  onClick,
}: {
  title: string;
  items: { label: string; value: number }[];
  onClick?: (label: string) => void;
}) {
  const max = items[0]?.value || 1;
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="mb-3 text-sm font-medium text-ink-100">{title}</p>
      <div className="space-y-2">
        {items.map((e) => {
          const Comp = onClick ? "button" : "div";
          return (
            <Comp
              key={e.label}
              onClick={onClick ? () => onClick(e.label) : undefined}
              className="block w-full text-left"
            >
              <div className="mb-1 flex justify-between text-xs text-ink-300">
                <span>{e.label}</span>
                <span>{fmtBRL(e.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-ink-800">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(e.value / max) * 100}%` }} />
              </div>
            </Comp>
          );
        })}
        {!items.length && <p className="text-sm text-ink-400">Sem dados no período.</p>}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-brand-600 bg-brand-950 text-brand-300" : "border-ink-600 text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
        good ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"
      }`}
    >
      {children}
    </span>
  );
}

// painel de detalhamento — mesmo esquema (clicar num elemento do gráfico ou
// num card abre um resumo) usado no produto, no mês e no vendedor. É um
// popup pequeno, flutuante, ancorado do lado do que foi clicado — não um
// modal grande cobrindo a tela — com a mesma translucidez/blur da sidebar.
function DetailPopover({
  anchor,
  title,
  onClose,
  children,
}: {
  anchor: { x: number; y: number };
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const WIDTH = 340;
  const MAX_HEIGHT = 420;
  const MARGIN = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = anchor.x + 16;
  if (left + WIDTH + MARGIN > vw) left = anchor.x - WIDTH - 16;
  left = Math.max(MARGIN, Math.min(left, vw - WIDTH - MARGIN));

  let top = anchor.y - 20;
  top = Math.max(MARGIN, Math.min(top, vh - MAX_HEIGHT - MARGIN));

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div
        className="sidebar-glass fixed z-[60] overflow-auto rounded-xl border border-white/10 p-3.5 shadow-2xl"
        style={{ left, top, width: WIDTH, maxHeight: MAX_HEIGHT }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink-50">{title}</p>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-ink-400 transition hover:bg-white/10 hover:text-ink-100"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-800/80 bg-ink-900/50 p-2">
      <p className="truncate text-[10px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink-50">{value}</p>
    </div>
  );
}

function TopList({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="rounded-lg border border-ink-800/80 bg-ink-900/50 p-2.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">{title}</p>
      {entries.length ? (
        <ul className="space-y-1 text-xs">
          {entries.map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-2">
              <span className="truncate text-ink-200">{label}</span>
              <span className="shrink-0 tabular-nums text-ink-400">
                {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-500">Sem dados.</p>
      )}
    </div>
  );
}
