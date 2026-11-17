/** Tipos e payload vazio do segmento Neutra (só leitura). */

export type NeutraEquipeRow = {
  nome: string;
  tt: string;
  tr: string;
  tipo: string;
  area: string;
  situacao: string;
  obs: string;
};

export type NeutraTechRow = {
  nome: string;
  tt: string;
  area: string;
  produtivas: number;
  improdutivas: number;
  pct_sucesso: number;
  tempo_medio_min: number | null;
  tempo_medio_label: string;
  reaprov_qtd: number;
  reaprov_pct: number;
  dias_trab: number;
  media_prod_dia: number;
  media_pend_dia: number;
  media_prod_semana: number;
  media_pend_semana: number;
  media_prod_mes: number;
  media_pend_mes: number;
  /** Valor a faturar INST+MUD (+ mesh/retirada se houver) no período. */
  valor_ok_tci: number;
};

export type NeutraResumo = {
  tecnicos: number;
  produtivas: number;
  improdutivas: number;
  pct_sucesso: number;
  tempo_medio_min: number | null;
  tempo_medio_label: string;
  reaprov_pct: number;
  reaprov_qtd: number;
  dias_atividade: number;
  /** INST+MUD com drop / sem drop (produtivas). */
  inst_mud_com_drop: number;
  inst_mud_sem_drop: number;
  valor_inst_mud: number;
};

/** Coluna de um dia no mês (visão por dia). */
export type NeutraVisaoDiaCol = {
  dia: number;
  weekday: string;
  key: string;
  /** Corte visual: dia 15 = 1ª; último dia = 2ª. */
  fechamento: "1a" | "2a" | null;
};

export type NeutraVisaoDiaRow = {
  nome: string;
  tt: string;
  tipo: string;
  is_pj: boolean;
  /** Produtivas por dia do mês (índice = dia − 1). */
  por_dia: number[];
  q1: number;
  q2: number;
  produtivas: number;
  improdutivas: number;
};

export type NeutraPagamentoQuinzena = {
  q1_referencia: string;
  q1_pago_em: string;
  q1_pago_em_iso: string;
  q2_referencia: string;
  q2_pago_em: string;
  q2_pago_em_iso: string;
  regra: string;
};

export type NeutraVisaoDia = {
  mes: string;
  cols: NeutraVisaoDiaCol[];
  rows: NeutraVisaoDiaRow[];
  total: NeutraVisaoDiaRow;
  pagamento: NeutraPagamentoQuinzena;
};

export type NeutraPayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  titulo: string;
  dados_ate: string | null;
  dados_ate_br: string | null;
  meses_disponiveis: string[];
  mes: string;
  resumo: NeutraResumo;
  tecnicos: NeutraTechRow[];
  /** Grade diária (só mês YYYY-MM; null em TOTAL). */
  visao_dia: NeutraVisaoDia | null;
  avisos: string[];
  equipe: NeutraEquipeRow[];
};

export function emptyNeutraPayload(
  mes: string,
  mensagem: string,
): NeutraPayload {
  return {
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem,
    titulo: "PAINEL PRODUÇÃO NEUTRA",
    dados_ate: null,
    dados_ate_br: null,
    meses_disponiveis: [],
    mes,
    resumo: {
      tecnicos: 0,
      produtivas: 0,
      improdutivas: 0,
      pct_sucesso: 0,
      tempo_medio_min: null,
      tempo_medio_label: "—",
      reaprov_pct: 0,
      reaprov_qtd: 0,
      dias_atividade: 0,
      inst_mud_com_drop: 0,
      inst_mud_sem_drop: 0,
      valor_inst_mud: 0,
    },
    tecnicos: [],
    visao_dia: null,
    avisos: [],
    equipe: [],
  };
}

export function formatTempoMedio(mins: number | null): string {
  if (mins == null || !Number.isFinite(mins)) return "—";
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
