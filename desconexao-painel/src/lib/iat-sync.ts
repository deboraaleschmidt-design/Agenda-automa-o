import { parseIatSheet, type IatPayload } from "./iat-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_D1_ID } from "./types";

export async function syncIat(): Promise<IatPayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) {
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "fixture",
      status: "aguardando_credencial_sheets",
      mensagem: auth.reason,
      titulo: "IAT",
      blocos: [],
      resumo: [],
    };
  }
  try {
    const res = await auth.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_D1_ID,
      range: "IAT!A1:L120",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = res.data.values || [];
    const parsed = parseIatSheet(rows);
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      ...parsed,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na D-1. Compartilhe ${SPREADSHEET_D1_ID} com ${auth.email} como Leitor.`
      : "";
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "fixture",
      status: "aguardando_credencial_sheets",
      mensagem: `Falha ao ler IAT: ${msg}.${hint}`,
      titulo: "IAT",
      blocos: [],
      resumo: [],
    };
  }
}
