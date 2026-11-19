/**
 * Aceite Debora 19/11 — Neutra histórica + TCI concluídas.
 * Run: npx --yes tsx scripts/banco-neutra-hist-aceite.ts
 */
import { google } from "googleapis";

const fails: string[] = [];
function assert(cond: boolean, msg: string) {
  if (!cond) fails.push(msg);
  else console.log("OK", msg);
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_V2?.trim();
  if (!raw) {
    console.error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_V2");
    process.exit(1);
  }
  if (
    !process.env.GOOGLE_SHEETS_NEUTRA_ID?.trim() &&
    !process.env.GOOGLE_SHEETS_D1_ID?.trim()
  ) {
    process.env.GOOGLE_SHEETS_D1_ID =
      "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";
    console.log("smoke: set GOOGLE_SHEETS_D1_ID for this process only");
  }

  const { mergeNeutraSheetRows } = await import("../src/lib/neutra-merge");
  const { buildNeutraFromBase } = await import("../src/lib/neutra-engine");
  const { syncBancoFromSheets } = await import("../src/lib/banco-sync");

  const parsed = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const id =
    process.env.GOOGLE_SHEETS_NEUTRA_ID?.trim() ||
    process.env.GOOGLE_SHEETS_D1_ID?.trim() ||
    "";

  let hist: unknown[][] = [];
  try {
    const h = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "'BASE NEUTRA HIST'!A1:Z",
      valueRenderOption: "FORMATTED_VALUE",
    });
    hist = h.data.values || [];
  } catch {
    hist = [];
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: [
      "'BASE NEUTRA'!A1:Z",
      "'PROMPT NEUTRA'!A1:Z",
      "'EQUIPE NEUTRA'!A1:H80",
    ],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const merged = mergeNeutraSheetRows({
    hist,
    base: ranges[0]?.values || [],
    prompt: ranges[1]?.values || [],
  });
  console.log(
    "fontes:",
    merged.fontes.join(" + "),
    "| hist:",
    merged.histPresente,
  );

  const expect: Record<string, number> = {
    "2026-08": 37,
    "2026-09": 3099,
    "2026-10": 3091,
    "2026-11": 1413,
  };

  for (const [mes, exp] of Object.entries(expect)) {
    const built = buildNeutraFromBase({
      baseRows: merged.rows,
      equipeRows: ranges[2]?.values || [],
      mes,
    });
    const got = built.resumo.produtivas + built.resumo.improdutivas;
    if (mes === "2026-11") {
      assert(
        Math.abs(got - exp) <= 5,
        `${mes} concluídas≈${exp} got ${got} (prod ${built.resumo.produtivas})`,
      );
    } else {
      assert(
        got === exp,
        `${mes} concluídas=${exp} got ${got} (prod ${built.resumo.produtivas})`,
      );
    }
    assert(
      built.meses_disponiveis.includes("2026-08"),
      "meses incluem 2026-08 (AGO)",
    );
  }

  const banco = await syncBancoFromSheets({ trigger: "smoke" });
  assert(banco.ok, `banco sync ok: ${banco.mensagem}`);
  assert(
    (banco.contagens.atividades_neutra || 0) > 1000,
    `atividades_neutra>1000 got ${banco.contagens.atividades_neutra}`,
  );
  assert(
    (banco.contagens.snapshots_mensais || 0) >= 4,
    `snapshots>=4 got ${banco.contagens.snapshots_mensais}`,
  );

  if (fails.length) {
    console.error("FAIL", fails);
    process.exit(1);
  }
  console.log("ALL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
