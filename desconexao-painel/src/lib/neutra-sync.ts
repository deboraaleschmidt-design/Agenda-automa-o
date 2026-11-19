import { mergeNeutraSheetRows } from "./neutra-merge";
import { buildNeutraFromBase } from "./neutra-engine";
import { emptyNeutraPayload, type NeutraPayload } from "./neutra-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_NEUTRA_ID } from "./types";

async function fetchOptionalHist(
  // googleapis Sheets client — tipagem frouxa de propósito
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string,
): Promise<unknown[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'BASE NEUTRA HIST'!A1:Z",
      valueRenderOption: "FORMATTED_VALUE",
    });
    return (res.data.values || []) as unknown[][];
  } catch {
    return [];
  }
}

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
    const [batch, histRows] = await Promise.all([
      auth.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_NEUTRA_ID,
        ranges: [
          "'BASE NEUTRA'!A1:Z",
          "'PROMPT NEUTRA'!A1:Z",
          "'EQUIPE NEUTRA'!A1:H80",
        ],
        valueRenderOption: "FORMATTED_VALUE",
      }),
      fetchOptionalHist(auth.sheets, SPREADSHEET_NEUTRA_ID),
    ]);
    const ranges = batch.data.valueRanges || [];
    const baseRows = ranges[0]?.values || [];
    const promptRows = ranges[1]?.values || [];
    const eqRows = ranges[2]?.values || [];
    const merged = mergeNeutraSheetRows({
      hist: histRows,
      base: baseRows,
      prompt: promptRows,
    });
    const built = buildNeutraFromBase({
      baseRows: merged.rows,
      equipeRows: eqRows,
      mes,
    });
    const avisos = [...(built.avisos || [])];
    avisos.unshift(
      `Fontes: ${merged.fontes.join(" → ") || "—"} · dedupe SA 1ª ocorrência (PROMPT > HIST > BASE).`,
    );
    if (!merged.histPresente) {
      avisos.push(
        "Aba BASE NEUTRA HIST ausente na D-1 — AGO/SET/OUT via PROMPT NEUTRA quando disponível.",
      );
    }
    return { ...built, avisos };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na planilha Neutra/D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyNeutraPayload(mes, `Falha ao ler Neutra: ${msg}.${hint}`);
  }
}
