export type PainelKpis = {
  recolhidos: number;
  entregues: number;
  em_processo: number;
  pct_entregue: number;
  /** cabecalho = células A4/I4/Q4/% do PAINEL; mes = só recolhas oficiais do mês. */
  escopo: "cabecalho" | "mes";
};

export type GradeColuna = {
  nome: string;
  codigo: string;
};

export type RankingTecnico = {
  nome: string;
  codigo: string;
  volume: number;
};

export type PainelPayload = {
  empresa: { id: string; nome_publico: string };
  setor: string;
  mes: string;
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  /** Linha "Atualizado · …" do PAINEL. */
  painel_atualizado?: string;
  /** Ex.: seriais duplicados desconsiderados. */
  nota_auditoria?: string;
  kpis: PainelKpis;
  grade_tecnicos: {
    colunas: GradeColuna[];
    /** rows: [dayNumber, ...counts per column] */
    dias: number[][];
    /** TOT por técnico (coluna TOT da grade PAINEL, se houver). */
    totais: number[];
    fonte_grade?: "painel" | "respostas" | "none";
  };
  ranking_tecnicos: RankingTecnico[];
  por_cidade_mes: Array<{
    cidade: string;
    meses: Record<string, number>;
    total: number;
  }>;
  evolucao_mensal: Array<{ mes: string; recolhas: number }>;
  /** Contagens do bloco TOTAL POR TIPO DE SERVIÇO no PAINEL. */
  por_tipo_servico: Array<{ tipo: string; quantidade: number }>;
  tipos_total?: number;
  a_pagar: Array<{
    tecnico: string;
    codigo: string;
    volume: number;
    tarifa: number;
    valor: number;
  }>;
};

export const SETOR_DESCONEXAO = "desconexao";
export const SETOR_IAT = "iat";
export const SETOR_FINANCEIRO = "financeiro";
export const EMPRESA_SEED_ID = "11111111-1111-4111-8111-111111111111";
export const NOME_PUBLICO = "T.ESTRATÉGICO";
export const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID?.trim() ||
  "1vpdyJ2zalgu913_XRP-vtUaJXpSsrSpdydWAbFZOeWU";
/** D-1 (IAT). Prefer secret GOOGLE_SHEETS_D1_ID; fallback = ID canônico do briefing. */
export const SPREADSHEET_D1_ID =
  process.env.GOOGLE_SHEETS_D1_ID?.trim() ||
  "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";

export const TECH_LABELS: Record<string, string> = {
  Z698465: "Guilherme",
  Z698466: "Alexandre",
  SMA: "Valter",
  TCI: "TCI",
};

export const MONTH_KEYS = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;
