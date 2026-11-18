import { buildIatFromBase } from "./iat-base-engine";
import {
  emptyIatPayload,
  parsePainelOk,
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
<<<<<<< HEAD
      ranges: [
        // DP:EB = colunas novas SET (18/11); EB cobre o bloco.
        "'BASE IAT'!A1:EB",
        "EQUIPE!A1:F40",
        "'PAINEL OK'!A1:J200",
      ],
=======
      ranges: ["'BASE IAT'!A1:DO", "'PROMPT IAT'!A1:DO", "EQUIPE!A1:F40"],
>>>>>>> origin/main
      valueRenderOption: "FORMATTED_VALUE",
    });
    const ranges = res.data.valueRanges || [];
    const baseRows = ranges[0]?.values || [];
<<<<<<< HEAD
    const eqRows = ranges[1]?.values || [];
    const painelOkRows = ranges[2]?.values || [];
=======
    const promptRows = ranges[1]?.values || [];
    const eqRows = ranges[2]?.values || [];
>>>>>>> origin/main
    const built = buildIatFromBase({
      baseRows,
      promptRows,
      equipeRows: eqRows,
      mes,
    });

    // PAINEL OK = aba fixa (até 17/11) — leitura, sem recalcular.
    const fromSheet = parsePainelOk(painelOkRows);
    const painel_ok = fromSheet.resumo
      ? {
          resumo: fromSheet.resumo,
          tecnicos: fromSheet.tecnicos,
          irreprodutiveis: [
            "Fonte: aba PAINEL OK (valores fixos na planilha · só leitura).",
          ],
        }
      : {
          resumo: built.painel_ok.resumo,
          tecnicos: built.painel_ok.tecnicos,
          irreprodutiveis: [
            ...(built.painel_ok.irreprodutiveis || []),
            "Aba PAINEL OK sem resumo legível — fallback BASE IAT.",
          ],
        };

    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      titulo: built.titulo,
      dados_ate: built.dados_ate,
      dados_ate_br: built.dados_ate_br,
      meses_disponiveis: built.meses_disponiveis,
      mes: built.mes,
      mes_aba: built.mes_aba,
      blocos: built.blocos,
      resumo: built.resumo,
      ranking: built.ranking,
      painel_ok,
      // Retorno legado na /iat: preferir página /retornos (aba RETORNOS).
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
