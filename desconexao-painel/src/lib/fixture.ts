import {
  EMPRESA_SEED_ID,
  MONTH_KEYS,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  type PainelPayload,
} from "./types";

/**
 * Placeholder until Sheets sync works.
 * Only the 4 técnicos do PAINEL real (sem Ricardo/Fernanda).
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

  const gradeNov = [
    [3, 6, 4, 4, 0],
    [4, 7, 4, 8, 1],
    [5, 6, 6, 7, 0],
    [6, 4, 5, 5, 1],
    [7, 2, 3, 2, 0],
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
      "Amostra local — sync Sheets ainda não ativo. Corrija GOOGLE_SERVICE_ACCOUNT_JSON_V2 e compartilhe a planilha como Leitor.",
    kpis: {
      recolhidos: 0,
      entregues: 0,
      em_processo: 0,
      pct_entregue: 0,
    },
    grade_tecnicos: { colunas, dias: gradeNov },
    por_cidade_mes: [],
    evolucao_mensal: MONTH_KEYS.map((m) => ({ mes: m, recolhas: 0 })),
    por_tipo_servico: [
      { tipo: "DESCONEXÃO", quantidade: 0 },
      { tipo: "RETIRADA", quantidade: 0 },
      { tipo: "INSTALAÇÃO", quantidade: 0 },
      { tipo: "TROCA PACOTE/TECNOLOGIA", quantidade: 0 },
    ],
    a_pagar: [],
  };
}
