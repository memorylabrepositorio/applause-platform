// Lógica portada fielmente de painel_checklist.html

export interface SectionField {
  key: string;
  label: string;
  long?: boolean;
}

export interface Section {
  title: string;
  fields: SectionField[];
}

// Cada grupo vira uma seção no formulário. "key" é a coluna na tabela
// checklist_eventos; "label" é o que aparece na tela; "long" usa textarea.
export const SECTIONS: Section[] = [
  {
    title: "Informações gerais",
    fields: [
      { key: "turma", label: "Turma" },
      { key: "adesao_atual", label: "Adesão atual" },
      { key: "capacidade_local", label: "Capacidade do local" },
      { key: "numero_formandos", label: "Número de formandos" },
      { key: "hora_local", label: "Data, hora e local", long: true },
      { key: "ensaio", label: "Ensaio" },
      { key: "sala_apoio", label: "Sala de apoio" },
      { key: "protocolo", label: "Protocolo" },
    ],
  },
  {
    title: "Cerimônia",
    fields: [
      { key: "musicas_individuais", label: "Músicas individuais" },
      { key: "fotos_individuais", label: "Fotos individuais" },
      { key: "ordem_chamada", label: "Ordem de chamada" },
      { key: "layout_cadeiras", label: "Layout de cadeiras" },
      { key: "musica_entrada", label: "Música de entrada" },
      { key: "musica_saida", label: "Música de saída" },
      { key: "musica_homenagem_pais", label: "Música homenagem aos pais" },
      { key: "video_homenagem", label: "Vídeo homenagem" },
      { key: "video_abertura", label: "Vídeo abertura" },
      { key: "video_reitor", label: "Vídeo reitor/institucional" },
      { key: "mesa_diretiva", label: "Mesa diretiva" },
      { key: "mestre_cerimonias", label: "Mestre de cerimônias" },
    ],
  },
  {
    title: "Materiais",
    fields: [
      { key: "copos", label: "Copos" },
      { key: "dinheiro_agua", label: "Dinheiro para água" },
      { key: "canudos", label: "Canudos" },
      { key: "porta_canudos", label: "Porta canudos" },
      { key: "togas", label: "Togas" },
      { key: "presentes", label: "Presentes" },
      { key: "rosas", label: "Rosas" },
      { key: "bandeiras", label: "Bandeiras" },
      { key: "porta_bandeiras", label: "Porta bandeiras" },
      { key: "ingressos_vip", label: "Ingressos VIP" },
      { key: "plaquinhas", label: "Plaquinhas" },
      { key: "faixa", label: "Faixa" },
      { key: "baloes", label: "Balões" },
      { key: "coquetel", label: "Coquetel" },
      { key: "maquiadora", label: "Maquiadora" },
    ],
  },
  {
    title: "Equipe e produção",
    fields: [
      { key: "equipe_recepcao", label: "Equipe recepção" },
      { key: "equipe_foto", label: "Equipe foto" },
      { key: "equipe_video", label: "Equipe vídeo" },
      { key: "decoracao", label: "Decoração" },
      { key: "som_luz_projecao", label: "Som, luz, projeção" },
    ],
  },
  {
    title: "Observações",
    fields: [{ key: "observacoes", label: "Observações gerais", long: true }],
  },
];

export const ALL_FIELD_KEYS: string[] = SECTIONS.reduce<string[]>(
  (acc, s) => acc.concat(s.fields.map((f) => f.key)),
  []
);

export type ChecklistStatus = "em_andamento" | "completo";

export interface ChecklistEvento {
  id: number;
  instituicao: string;
  turma?: string | null;
  curso?: string | null;
  nro_controle?: string | null;
  status: ChecklistStatus;
  criado_em?: string;
  data_evento?: string | null;
  [key: string]: unknown;
}

export interface ContratoRow {
  nro_controle: string;
  instituicao: string;
  curso: string;
  ano_periodo: string;
  status?: string;
  qtde_clientes?: number;
}

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function progressOf(evento: ChecklistEvento): number {
  let filled = 0;
  ALL_FIELD_KEYS.forEach((k) => {
    const v = evento[k];
    if (v && String(v).trim()) filled++;
  });
  return Math.round((filled / ALL_FIELD_KEYS.length) * 100);
}

export const SEM_PERIODO = "__sem_periodo__";

// filtro é só por ano (não por semestre); "9999-99" e afins são placeholder
// de contrato sem período definido, então ficam fora da lista de anos.
export function anoDoContrato(raw?: string | null): string {
  const m = (raw || "").trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!m || m[1] === "9999") return "";
  return m[1];
}

export function checklistDoContrato(
  eventos: ChecklistEvento[],
  nroControle: string
): ChecklistEvento | undefined {
  return eventos.find((e) => e.nro_controle === nroControle);
}

export function isCompleto(evento: ChecklistEvento): boolean {
  return evento.status === "completo";
}
