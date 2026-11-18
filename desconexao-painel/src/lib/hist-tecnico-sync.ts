import {
  emptyHistTecnicoPayload,
  parseHistoricoTecnico,
  type HistTecnicoPayload,
} from "./hist-tecnico-parse";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_D1_ID } from "./types";

export async function syncHistTecnico(): Promise<HistTecnicoPayload> {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) return emptyHistTecnicoPayload(auth.reason);
  if (!SPREADSHEET_D1_ID) {
    return emptyHistTecnicoPayload(
      "GOOGLE_SHEETS_D1_ID não configurado. Defina o secret da D-1.",
    );
  }
  try {
    const res = await auth.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_D1_ID,
      ranges: ["'HISTÓRICO TÉCNICO'!A1:L400"],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = res.data.valueRanges?.[0]?.values || [];
    const parsed = parseHistoricoTecnico(rows);
    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      titulo: parsed.titulo,
      periodo_nota: parsed.periodo_nota,
      ordem_nota: parsed.ordem_nota,
      cards: parsed.cards,
      meses_disponiveis: ["TOTAL", "2026-09", "2026-10", "2026-11"],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyHistTecnicoPayload(`Falha ao ler Histórico Técnico: ${msg}.${hint}`);
  }
}
