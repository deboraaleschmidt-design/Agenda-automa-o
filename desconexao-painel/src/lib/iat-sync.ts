import {
  emptyIatPayload,
  parseEquipe,
  parseIatSheet,
  parsePainelOk,
  parseRetorno,
  type IatPayload,
} from "./iat-parse";
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
      ranges: [
        "IAT!A1:AH120",
        "'PAINEL OK'!A1:L120",
        "'RETORNO CREDENCIADA'!A1:L80",
        "EQUIPE!A1:F40",
      ],
      valueRenderOption: "FORMATTED_VALUE",
    });
    const ranges = res.data.valueRanges || [];
    const iatRows = ranges[0]?.values || [];
    const okRows = ranges[1]?.values || [];
    const retRows = ranges[2]?.values || [];
    const eqRows = ranges[3]?.values || [];

    const parsed = parseIatSheet(iatRows);
    const painel_ok = parsePainelOk(okRows);
    const retorno = parseRetorno(retRows);
    const equipe = parseEquipe(eqRows);

    const mesReq = mes.trim().toUpperCase() === "TOTAL" ? "TOTAL" : mes.trim();
    const mesMatch =
      mesReq === "TOTAL" ||
      (parsed.mes_aba != null && parsed.mes_aba === mesReq);

    let mensagem: string | undefined;
    if (!mesMatch && parsed.mes_aba) {
      mensagem = `Aba IAT na D-1 está em ${parsed.mes_aba}. Grades dia×técnico / resumo IAT referem esse mês; PAINEL OK e RETORNO espelham o recorte estático da planilha (até 08/11 na leitura). Escolha ${parsed.mes_aba} ou TOTAL da aba.`;
    }

    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      mensagem,
      titulo: parsed.titulo,
      mes: mesReq,
      mes_aba: parsed.mes_aba,
      blocos: mesMatch || mesReq === "TOTAL" ? parsed.blocos : [],
      resumo: mesMatch || mesReq === "TOTAL" ? parsed.resumo : [],
      ranking: mesMatch || mesReq === "TOTAL" ? parsed.ranking : [],
      painel_ok,
      retorno,
      equipe,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hint = msg.toLowerCase().includes("permission")
      ? ` Sem permissão na D-1. Compartilhe com ${auth.email} como Leitor.`
      : "";
    return emptyIatPayload(mes, `Falha ao ler D-1: ${msg}.${hint}`);
  }
}
