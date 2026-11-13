import {
  EMPRESA_SEED_ID,
  MONTH_KEYS,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  type PainelPayload,
} from "./types";

/**
 * Amostra local (sem Sheets). Números = snapshot PAINEL 12/11/2026
 * para prévia Etapa 1; runtime live usa sync real.
 */
export function buildFixturePayload(
  mes: string,
  mensagem?: string,
): PainelPayload {
  const colunas = [
    { nome: "Guilherme", codigo: "Z698465" },
    { nome: "Alexandre", codigo: "Z698466" },
    { nome: "Valter", codigo: "SMA" },
    { nome: "TCI", codigo: "TCI" },
  ];

  const isTotal = mes.trim().toUpperCase() === "TOTAL";
  const isNov = mes.trim() === "2026-11";

  const gradeNov = [
    [3, 0, 3, 5, 0],
    [4, 9, 4, 2, 0],
    [5, 8, 2, 8, 1],
    [6, 2, 13, 8, 0],
    [7, 6, 0, 3, 1],
    [9, 5, 0, 2, 0],
    [10, 5, 0, 2, 0],
    [11, 2, 5, 3, 0],
    [12, 2, 0, 0, 0],
  ];
  const totaisNov = [39, 27, 33, 2];

  const cidades = [
    {
      cidade: "SANTA MARIA",
      meses: {
        JAN: 0,
        FEV: 0,
        MAR: 27,
        ABR: 144,
        MAI: 119,
        JUN: 93,
        JUL: 113,
        AGO: 112,
        SET: 110,
        OUT: 90,
        NOV: 26,
        DEZ: 0,
      },
      total: 834,
    },
    {
      cidade: "CANOAS",
      meses: {
        JAN: 0,
        FEV: 0,
        MAR: 0,
        ABR: 0,
        MAI: 0,
        JUN: 0,
        JUL: 7,
        AGO: 54,
        SET: 121,
        OUT: 206,
        NOV: 41,
        DEZ: 0,
      },
      total: 429,
    },
    {
      cidade: "PORTO ALEGRE",
      meses: {
        JAN: 1,
        FEV: 0,
        MAR: 43,
        ABR: 4,
        MAI: 27,
        JUN: 3,
        JUL: 1,
        AGO: 29,
        SET: 107,
        OUT: 145,
        NOV: 34,
        DEZ: 0,
      },
      total: 394,
    },
  ];

  const evo = [
    1, 0, 78, 177, 155, 118, 128, 199, 354, 445, 101, 0,
  ];
  const evolucao_mensal = MONTH_KEYS.map((m, i) => ({
    mes: m,
    recolhas: evo[i],
  }));

  const tiposNov = [
    { tipo: "RETIRADA", quantidade: 57 },
    { tipo: "DESCONEXÃO", quantidade: 15 },
    { tipo: "TROCA PACOTE/TECNOLOGIA", quantidade: 14 },
    { tipo: "INSTALAÇÃO", quantidade: 15 },
  ];
  const tiposTotal = [
    { tipo: "RETIRADA", quantidade: 604 },
    { tipo: "DESCONEXÃO", quantidade: 243 },
    { tipo: "TROCA PACOTE/TECNOLOGIA", quantidade: 102 },
    { tipo: "INSTALAÇÃO", quantidade: 86 },
    { tipo: "VERIFICAR", quantidade: 61 },
    { tipo: "CONTROLE", quantidade: 2 },
    { tipo: "REINSTALAÇÃO", quantidade: 1 },
  ];

  return {
    empresa: { id: EMPRESA_SEED_ID, nome_publico: NOME_PUBLICO },
    setor: SETOR_DESCONEXAO,
    mes,
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem:
      mensagem ||
      "Amostra local (snapshot PAINEL) — sync Sheets ainda não ativo neste ambiente.",
    painel_atualizado:
      "Atualizado · NOVEMBRO/2026 · v18 BASE+PAINEL · sem chart no Atualizar",
    nota_auditoria:
      "Seriais duplicados desconsiderados: 6 (mantido o último registro)",
    kpis: isTotal
      ? {
          recolhidos: 1757,
          entregues: 1470,
          em_processo: 287,
          pct_entregue: 0.837,
          escopo: "cabecalho",
        }
      : {
          recolhidos: isNov ? 101 : evo[Math.max(0, Number(mes.split("-")[1] || 1) - 1)] || 0,
          entregues: isNov ? 40 : 0,
          em_processo: isNov ? 61 : 0,
          pct_entregue: isNov ? 40 / 101 : 0,
          escopo: "mes",
          fonte_mes: isNov ? "respostas" : "none",
        },
    grade_tecnicos: {
      colunas,
      dias: isNov ? gradeNov : [],
      totais: totaisNov,
      fonte_grade: isNov ? "painel" : "none",
    },
    ranking_tecnicos: [
      { nome: "Guilherme", codigo: "Z698465", volume: 39 },
      { nome: "Valter", codigo: "SMA", volume: 33 },
      { nome: "Alexandre", codigo: "Z698466", volume: 27 },
      { nome: "TCI", codigo: "TCI", volume: 2 },
    ].sort((a, b) => b.volume - a.volume),
    por_cidade_mes: cidades,
    evolucao_mensal,
    por_tipo_servico: isTotal ? tiposTotal : isNov ? tiposNov : [],
    tipos_total: isTotal ? 1099 : isNov ? 101 : 0,
    a_pagar: [],
  };
}
