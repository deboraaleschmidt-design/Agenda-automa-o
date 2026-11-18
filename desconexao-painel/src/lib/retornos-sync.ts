import {
  emptyRetornosPayload,
  parseRetornosSheet,
  type RetornosPayload,
} from "./retornos-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_D1_ID } from "./types";

export async function syncRetornos(): Promise<RetornosPayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) return emptyRetornosPayload(auth.reason);
  if (!SPREADSHEET_D1_ID) {
    return emptyRetornosPayload(
      "GOOGLE_SHEETS_D1_ID não configurado. Defina o secret da D-1.",
    );
  }
  try {
    const res = await auth.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_D1_ID,
      ranges: ["RETORNOS!A1:V250"],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = res.data.valueRanges?.[0]?.values || [];
    const parsed = parseRetornosSheet(rows);
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      ...parsed,
      meses_disponiveis: ["2026-09", "2026-10", "2026-11"],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyRetornosPayload(`Falha ao ler RETORNOS: ${msg}.${hint}`);
  }
}
