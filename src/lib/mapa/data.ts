import type { LucideIcon } from "lucide-react";
import { Landmark, Handshake, GalleryHorizontalEnd, Clapperboard, Wallet, Megaphone } from "lucide-react";

/**
 * Conteúdo do Mapa (página inicial).
 *
 * Cada departamento é uma "constelação": um ícone ligado ao núcleo e
 * "ramos" de funções encadeadas. Pra incluir uma função nova, basta
 * acrescentar uma linha no ramo certo — o desenho se recalcula sozinho.
 *
 *  - status "ok"  → em produção (ponto cheio)
 *  - status "dev" → em desenvolvimento (ponto vazado)
 *  - `to`         → rota de um módulo desta plataforma (o ponto vira link)
 *  - `origem`     → sistema externo onde a função roda hoje (worker, n8n,
 *                   Apps Script…); aparece na dica ao passar o mouse
 *
 * A ordem do array define a posição no círculo (sentido horário, começando
 * no canto superior esquerdo). O mapa comporta exatamente 6 departamentos.
 */

export type MapaStatus = "ok" | "dev";

export interface MapaFuncao {
  nome: string;
  status: MapaStatus;
  to?: string;
  origem?: string;
}

export interface MapaDepartamento {
  id: string;
  nome: string;
  sub: string;
  cor: string;
  icon: LucideIcon;
  /** módulo principal do departamento na plataforma (se houver) */
  to?: string;
  ramos: MapaFuncao[][];
}

export const MAPA_NUCLEO = { nome: "Base de Conhecimento", sub: "nó zero" };

/** departamento que abre em destaque */
export const MAPA_FOCO_INICIAL = "vendas";

export const DEPARTAMENTOS: MapaDepartamento[] = [
  {
    id: "financeiro",
    nome: "Financeiro",
    sub: "contas · cobranças · lucro",
    cor: "#FACC15",
    icon: Landmark,
    to: "/financeiro",
    ramos: [
      [
        { nome: "Contas a receber", status: "ok", to: "/financeiro" },
        { nome: "Cobrança Asaas", status: "ok", to: "/financeiro" },
        { nome: "Alertas de pagamento no WhatsApp", status: "dev" },
      ],
      [
        { nome: "Contas a pagar", status: "ok", to: "/contas-pagar" },
        { nome: "Lucro por contrato", status: "ok", to: "/lucro" },
        { nome: "DRE e fluxo de caixa", status: "dev" },
      ],
      [
        { nome: "Triagem de notas fiscais", status: "ok", origem: "n8n" },
        { nome: "Conciliação bancária", status: "dev" },
        { nome: "Despesa por foto (OCR)", status: "dev" },
      ],
    ],
  },
  {
    id: "atendimento",
    nome: "Atendimento",
    sub: "CRM · SDR · WhatsApp",
    cor: "#FB7185",
    icon: Handshake,
    to: "/atendimento",
    ramos: [
      [
        { nome: "CRM de atendimento", status: "ok", to: "/atendimento" },
        { nome: "Follow-up e tarefas", status: "ok", to: "/atendimento" },
        { nome: "Portal do aluno", status: "dev", origem: "applause-app" },
      ],
      [
        { nome: "SDR · lembretes no WhatsApp", status: "ok", to: "/sdr" },
        { nome: "SDR · IA conversando com o aluno", status: "dev", to: "/sdr" },
        { nome: "Configuração do agente", status: "ok", to: "/configuracoes#agente" },
      ],
      [
        { nome: "Notificações in-app e push", status: "ok", origem: "applause-app" },
        { nome: "Envio em massa (fila)", status: "ok", origem: "applause-app" },
        { nome: "Agenda Google Calendar", status: "ok", origem: "applause-app" },
      ],
    ],
  },
  {
    id: "producao",
    nome: "Produção",
    sub: "itens · solenidade · fotos",
    cor: "#A78BFA",
    icon: GalleryHorizontalEnd,
    to: "/producao",
    ramos: [
      [
        { nome: "Status dos itens vendidos", status: "ok", to: "/producao" },
        { nome: "Checklist de solenidade", status: "ok", to: "/checklist" },
        { nome: "Funil de álbuns", status: "ok", origem: "Apps Script" },
      ],
      [
        { nome: "Reconhecimento facial", status: "ok", origem: "RECFACIAL-IA" },
        { nome: "Separação de fotos por aluno", status: "ok", origem: "RECFACIAL-IA" },
        { nome: "Painel remoto do reconhecimento", status: "dev", origem: "Render" },
      ],
      [
        { nome: "Auto Export Lightroom", status: "ok", origem: "plugin Lightroom" },
        { nome: "Seleção de álbum pelo aluno", status: "dev", origem: "applause-app" },
      ],
    ],
  },
  {
    id: "criacao",
    nome: "Criação",
    sub: "convites · vídeos · músicas",
    cor: "#38BDF8",
    icon: Clapperboard,
    ramos: [
      [
        { nome: "Convites (Photoshop)", status: "ok", origem: "worker de renderização" },
        { nome: "Convites sem foto", status: "ok", origem: "worker de renderização" },
        { nome: "Vídeo telão (After Effects)", status: "ok", origem: "worker de renderização" },
        { nome: "Vídeo sem foto", status: "ok", origem: "worker de renderização" },
      ],
      [
        { nome: "Corte de músicas", status: "ok", origem: "worker de renderização" },
        { nome: "Slideshow de fotos com fade", status: "dev", origem: "worker de renderização" },
        { nome: "Monitor de erros com IA", status: "dev", origem: "error-monitor" },
      ],
    ],
  },
  {
    id: "vendas",
    nome: "Vendas",
    sub: "painel · Pronet · estúdio",
    cor: "#EF4444",
    icon: Wallet,
    to: "/vendas",
    ramos: [
      [
        { nome: "Painel de vendas", status: "ok", to: "/vendas" },
        { nome: "P4F / Sessão estúdio", status: "ok", to: "/p4f" },
        { nome: "Agendados × compraram", status: "ok", to: "/vendas" },
      ],
      [
        { nome: "Exportação diária do Pronet", status: "ok", origem: "PronetAutomacao" },
        { nome: "Relatório mensal automático", status: "ok", origem: "Apps Script" },
        { nome: "Painel de vendedores e comissão", status: "ok", origem: "Apps Script" },
        { nome: "Import do Pronet na plataforma", status: "dev" },
      ],
    ],
  },
  {
    id: "marketing",
    nome: "Marketing",
    sub: "anúncios · Reels · Instagram",
    cor: "#7DD3FC",
    icon: Megaphone,
    ramos: [
      [
        { nome: "Ad Manager Hub", status: "ok", origem: "applause-ads-flow" },
        { nome: "Reels de recreios (corte por BPM)", status: "dev" },
        { nome: "Aprendizado com o editor", status: "dev" },
      ],
    ],
  },
];
