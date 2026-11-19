/**
 * Aceite Debora 19/11 — Neutra HIST + dedupe PROMPT > HIST > BASE (1ª vence).
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
  const base = ranges[0]?.values || [];
  const prompt = ranges[1]?.values || [];
  const eq = ranges[2]?.values || [];

  console.log("HIST rows", hist.length);

  const withPrompt = mergeNeutraSheetRows({ hist, base, prompt });
  const withoutPrompt = mergeNeutraSheetRows({ hist, base, prompt: [] });
  assert(
    withPrompt.fontes[0] === "PROMPT NEUTRA" || !prompt.length,
    `ordem fontes começa PROMPT: ${withPrompt.fontes.join(">")}`,
  );
  assert(withPrompt.histPresente, "HIST presente");
  assert(
    withPrompt.fontes.join(">") === "PROMPT NEUTRA>BASE NEUTRA HIST>BASE NEUTRA" ||
      withPrompt.fontes.join(">") === "PROMPT NEUTRA>BASE NEUTRA HIST",
    `fontes=${withPrompt.fontes.join(">")}`,
  );

  const expect: Record<string, number> = {
    "2026-08": 37,
    "2026-09": 3099,
    "2026-10": 3091,
    "2026-11": 1413,
  };

  for (const label of ["com PROMPT", "sem PROMPT"] as const) {
    const merged = label === "com PROMPT" ? withPrompt : withoutPrompt;
    console.log("\n===", label, merged.fontes.join(" → "));
    for (const [mes, exp] of Object.entries(expect)) {
      const built = buildNeutraFromBase({
        baseRows: merged.rows,
        equipeRows: eq,
        mes,
      });
      const got = built.resumo.produtivas + built.resumo.improdutivas;
      if (mes === "2026-11") {
        assert(
          got === exp &&
            built.resumo.produtivas === 1012 &&
            built.resumo.improdutivas === 401,
          `${label} ${mes} concl=${exp} (1012/401) got ${got} (${built.resumo.produtivas}/${built.resumo.improdutivas})`,
        );
        const vd = built.visao_dia;
        // soma produtivas do dia 17 na visão
        let dia17 = 0;
        if (vd) {
          const idx = vd.cols.findIndex((c) => Number(c.dia) === 17);
          if (idx >= 0) {
            for (const row of vd.rows) {
              dia17 += Number(row.por_dia?.[idx] || 0);
            }
          }
        }
        assert(dia17 === 60, `${label} dia 17/11 produtivas=60 got ${dia17}`);
      } else {
        assert(
          got === exp,
          `${label} ${mes} concluídas=${exp} got ${got}`,
        );
      }
    }
  }

  if (fails.length) {
    console.error("FAIL", fails);
    process.exit(1);
  }
  console.log("\nALL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
