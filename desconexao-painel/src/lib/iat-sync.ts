import { buildIatFromBase } from "./iat-base-engine";
import { emptyIatPayload, type IatPayload } from "./iat-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_D1_ID } from "./types";

export async function syncIat(mes = "TOTAL"): Promise<IatPayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) {
    return emptyIatPayload(mes, auth.reason);
  }
  if (!SPREADSHEET_D1_ID) {
    return emptyIatPayload(
      mes,
      "GOOGLE_SHEETS_D1_ID não configurado. Defina o secret da D-1.",
    );
  }
  try {
    const res = await auth.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_D1_ID,
      ranges: ["'BASE IAT'!A1:DO", "EQUIPE!A1:F40"],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const ranges = res.data.valueRanges || [];
    const baseRows = ranges[0]?.values || [];
    const eqRows = ranges[1]?.values || [];
    const built = buildIatFromBase({
      baseRows,
      equipeRows: eqRows,
      mes,
    });

    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      titulo: built.titulo,
      mes: built.mes,
      mes_aba: built.mes_aba,
      blocos: built.blocos,
      resumo: built.resumo,
      ranking: built.ranking,
      painel_ok: built.painel_ok,
      retorno: built.retorno,
      equipe: built.equipe,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyIatPayload(mes, `Falha ao ler D-1: ${msg}.${hint}`);
  }
}
