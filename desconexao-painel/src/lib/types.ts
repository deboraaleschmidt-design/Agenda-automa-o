export type PainelKpis = {
  recolhidos: number;
  entregues: number;
  em_processo: number;
  pct_entregue: number;
};

export type GradeColuna = {
  nome: string;
  codigo: string;
};

export type PainelPayload = {
  empresa: { id: string; nome_publico: string };
  setor: string;
  mes: string;
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  kpis: PainelKpis;
  grade_tecnicos: {
    colunas: GradeColuna[];
    /** rows: [dayNumber, ...counts per column] */
    dias: number[][];
  };
  por_cidade_mes: Array<{
    cidade: string;
    meses: Record<string, number>;
    total: number;
  }>;
  evolucao_mensal: Array<{ mes: string; recolhas: number }>;
  /** Contagens do mês a partir de Respostas col. SERVIÇO (L). */
  por_tipo_servico: Array<{ tipo: string; quantidade: number }>;
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
