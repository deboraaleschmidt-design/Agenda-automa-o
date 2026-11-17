/**
 * Smoke OPEX + IAT 16/11 + ranking D-1.
 * Run: npx --yes tsx scripts/opex-smoke.ts
 */
import { google } from "googleapis";

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_V2?.trim();
  if (!raw) {
    console.error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_V2");
    process.exit(1);
  }
  if (!process.env.GOOGLE_SHEETS_D1_ID?.trim()) {
    process.env.GOOGLE_SHEETS_D1_ID =
      "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";
  }
  if (!process.env.GOOGLE_SHEETS_NEUTRA_ID?.trim()) {
    process.env.GOOGLE_SHEETS_NEUTRA_ID = process.env.GOOGLE_SHEETS_D1_ID;
  }
  if (!process.env.GOOGLE_SHEETS_ID?.trim()) {
    process.env.GOOGLE_SHEETS_ID =
      "1vpdyJ2zalgu913_XRP-vtUaJXpSsrSpdydWAbFZOeWU";
  }

  const { buildIatFromBase } = await import("../src/lib/iat-base-engine");
  const { parseRankingFromDesconexaoD1 } = await import(
    "../src/lib/painel-parse"
  );
  const { syncFinanceiro } = await import("../src/lib/finance-sync");

  const parsed = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEETS_D1_ID!;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: [
      "'BASE IAT'!A1:DO",
      "'PROMPT IAT'!A1:DO",
      "EQUIPE!A1:F40",
      "'DESCONEXÃO'!A1:AG40",
    ],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const built = buildIatFromBase({
    baseRows: ranges[0]?.values || [],
    promptRows: ranges[1]?.values || [],
    equipeRows: ranges[2]?.values || [],
    mes: "2026-11",
  });
  const day16 = built.blocos
    .filter((b) => b.kind === "produtivas")
    .map((b) => ({
      base: b.base,
      d16: b.tecnicos.reduce((s, t) => s + (t.dias[15] || 0), 0),
    }));
  console.log("IAT dados_ate", built.dados_ate_br, "promptDays", built.promptDays);
  console.log("IAT day16 produtivas", JSON.stringify(day16));
  console.log("IAT resumo TOTAL", built.resumo.find((r) => r.base === "TOTAL"));

  const rank = parseRankingFromDesconexaoD1(ranges[3]?.values || []);
  console.log(
    "Ranking D-1",
    rank.mesYm,
    rank.ranking.map((r) => `${r.nome}=${r.volume}`).join(" | "),
  );

  for (const seg of ["neutra", "iat", "desconexao"] as const) {
    const fin = await syncFinanceiro({ mes: "2026-11", segmento: seg });
    console.log(
      `\n=== ${seg} === receita`,
      fin.opex?.receita,
      "custo",
      fin.opex?.custo_total,
      "lucro",
      fin.opex?.lucro,
      "margem",
      fin.opex?.margem != null
        ? `${(fin.opex.margem * 100).toFixed(1)}%`
        : null,
    );
    console.log(
      "Q1",
      fin.pagamento_quinzenas[0]?.corte,
      "pago",
      fin.pagamento_quinzenas[0]?.pago_em,
      "total",
      fin.pagamento_quinzenas[0]?.total,
      "n",
      fin.pagamento_quinzenas[0]?.linhas.length,
    );
    console.log(
      "Q2",
      fin.pagamento_quinzenas[1]?.corte,
      "pago",
      fin.pagamento_quinzenas[1]?.pago_em,
      "total",
      fin.pagamento_quinzenas[1]?.total,
      "n",
      fin.pagamento_quinzenas[1]?.linhas.length,
    );
    console.log(
      "Q1 top",
      fin.pagamento_quinzenas[0]?.linhas
        .slice(0, 3)
        .map((l) => `${l.tecnico}:${l.tipo}:${l.atividades}:${l.valor}`)
        .join(" · "),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
