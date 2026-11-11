import { parseAPagar, parseFaturamento, type FinancePayload } from "./finance-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_ID } from "./types";

export async function syncFinanceiro(): Promise<FinancePayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) {
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "fixture",
      status: "aguardando_credencial_sheets",
      mensagem: auth.reason,
      quinzena_titulo: "",
      a_pagar: [],
      total_a_pagar: 0,
      faturamento_meses: [],
      faturamento_ago_mais: { recolhas: 0, valor: 0 },
    };
  }
  try {
    const res = await auth.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ["'PAINEL RECOLHAS'!A1:E40", "'FATURAR CLARO'!A1:E40"],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const ranges = res.data.valueRanges || [];
    const recolhas = ranges[0]?.values || [];
    const faturar = ranges[1]?.values || [];
    const pagar = parseAPagar(recolhas);
    const fat = parseFaturamento(faturar);
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      mensagem: pagar.titulo,
      quinzena_titulo: pagar.titulo,
      a_pagar: pagar.linhas,
      total_a_pagar: pagar.total,
      faturamento_meses: fat.meses,
      faturamento_ago_mais: fat.agoMais,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "fixture",
      status: "aguardando_credencial_sheets",
      mensagem: `Falha ao ler financeiro: ${msg}. Confira SA V2 nas abas PAINEL RECOLHAS e FATURAR CLARO.`,
      quinzena_titulo: "",
      a_pagar: [],
      total_a_pagar: 0,
      faturamento_meses: [],
      faturamento_ago_mais: { recolhas: 0, valor: 0 },
    };
  }
}
