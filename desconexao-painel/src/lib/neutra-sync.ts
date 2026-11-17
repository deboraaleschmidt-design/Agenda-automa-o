import { buildNeutraFromBase } from "./neutra-engine";
import { emptyNeutraPayload, type NeutraPayload } from "./neutra-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_NEUTRA_ID } from "./types";

export async function syncNeutra(mes = "TOTAL"): Promise<NeutraPayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) {
    return emptyNeutraPayload(
      mes,
      auth.reason || "Credencial Sheets indisponível.",
    );
  }
  if (!SPREADSHEET_NEUTRA_ID) {
    return emptyNeutraPayload(
      mes,
      "GOOGLE_SHEETS_NEUTRA_ID (ou GOOGLE_SHEETS_D1_ID) não configurado. Defina o secret da planilha Neutra/D-1 — sem id fixo no código.",
    );
  }
  try {
    const res = await auth.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_NEUTRA_ID,
      ranges: ["'BASE NEUTRA'!A1:Z", "'EQUIPE NEUTRA'!A1:H80"],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const ranges = res.data.valueRanges || [];
    const baseRows = ranges[0]?.values || [];
    const eqRows = ranges[1]?.values || [];
    return buildNeutraFromBase({
      baseRows,
      equipeRows: eqRows,
      mes,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na planilha Neutra/D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyNeutraPayload(mes, `Falha ao ler Neutra: ${msg}.${hint}`);
  }
}
