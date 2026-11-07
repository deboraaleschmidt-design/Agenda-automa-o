import {
  EMPRESA_SEED_ID,
  MONTH_KEYS,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  type PainelPayload,
} from "./types";

/** Sample shaped like the piloto painel demo — used until Sheets credentials exist. */
export function buildFixturePayload(mes: string): PainelPayload {
  const colunas = [
    { nome: "Guilherme", codigo: "Z698465" },
    { nome: "Alexandre", codigo: "Z698466" },
    { nome: "Valter", codigo: "SMA" },
    { nome: "TCI", codigo: "TCI" },
    { nome: "Ricardo", codigo: "Z701102" },
    { nome: "Fernanda", codigo: "Z701188" },
  ];

  const gradeNov = [
    [1, 6, 5, 3, 1, 2, 2],
    [2, 5, 4, 4, 2, 3, 1],
    [3, 7, 6, 2, 0, 2, 3],
    [4, 4, 5, 3, 1, 1, 2],
    [5, 6, 3, 4, 2, 3, 2],
    [6, 5, 6, 3, 1, 2, 1],
    [7, 8, 4, 2, 0, 2, 3],
    [8, 5, 5, 4, 2, 3, 2],
    [9, 6, 4, 3, 1, 1, 2],
    [10, 4, 6, 4, 1, 3, 1],
    [11, 7, 5, 2, 2, 2, 3],
    [12, 5, 4, 3, 0, 2, 2],
  ];

  const cidades = [
    { cidade: "SANTA MARIA", ago: 42, set: 48, out: 51, nov: 55 },
    { cidade: "CANOAS", ago: 28, set: 31, out: 29, nov: 34 },
    { cidade: "PORTO ALEGRE", ago: 19, set: 22, out: 25, nov: 27 },
    { cidade: "CACHOEIRINHA", ago: 15, set: 14, out: 18, nov: 21 },
    { cidade: "GRAVATAÍ", ago: 12, set: 16, out: 15, nov: 19 },
    { cidade: "PASSO FUNDO", ago: 9, set: 11, out: 13, nov: 14 },
  ];

  return {
    empresa: { id: EMPRESA_SEED_ID, nome_publico: NOME_PUBLICO },
    setor: SETOR_DESCONEXAO,
    mes,
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem:
      "Snapshot de amostra. Compartilhe a planilha com a service account e defina GOOGLE_SERVICE_ACCOUNT_JSON + PAINEL_API_TOKEN nos secrets do app.",
    kpis: {
      recolhidos: 428,
      entregues: 391,
      em_processo: 37,
      pct_entregue: 0.914,
    },
    grade_tecnicos: { colunas, dias: gradeNov },
    por_cidade_mes: cidades.map((c) => {
      const meses: Record<string, number> = {};
      for (const k of MONTH_KEYS) meses[k] = 0;
      meses.AGO = c.ago;
      meses.SET = c.set;
      meses.OUT = c.out;
      meses.NOV = c.nov;
      return {
        cidade: c.cidade,
        meses,
        total: c.ago + c.set + c.out + c.nov,
      };
    }),
    evolucao_mensal: [
      { mes: "AGO", recolhas: 312 },
      { mes: "SET", recolhas: 356 },
      { mes: "OUT", recolhas: 389 },
      { mes: "NOV", recolhas: 428 },
    ],
    por_tipo_servico: [
      { tipo: "DESCONEXÃO", quantidade: 186 },
      { tipo: "RETIRADA", quantidade: 142 },
      { tipo: "INSTALAÇÃO", quantidade: 58 },
      { tipo: "TROCA PACOTE/TECNOLOGIA", quantidade: 42 },
    ],
    a_pagar: [
      { tecnico: "Guilherme", codigo: "Z698465", volume: 58, tarifa: 0, valor: 0 },
      { tecnico: "Alexandre", codigo: "Z698466", volume: 52, tarifa: 0, valor: 0 },
      { tecnico: "Valter", codigo: "SMA", volume: 38, tarifa: 20, valor: 760 },
      { tecnico: "TCI", codigo: "TCI", volume: 12, tarifa: 0, valor: 0 },
      { tecnico: "Ricardo", codigo: "Z701102", volume: 31, tarifa: 15, valor: 465 },
      { tecnico: "Fernanda", codigo: "Z701188", volume: 27, tarifa: 15, valor: 405 },
    ],
  };
}
