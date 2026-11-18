/**
 * Aceite Debora 18/11 — SET + Histórico + Retornos + Neutra + PAINEL OK.
 * Run: npx --yes tsx scripts/d1-set-hist-retornos-aceite.ts
 */
import { google } from "googleapis";
import { buildIatFromBase } from "../src/lib/iat-base-engine";
import { parsePainelOk, parseEquipe } from "../src/lib/iat-parse";
import { parseHistoricoTecnico } from "../src/lib/hist-tecnico-parse";
import { parseRetornosSheet } from "../src/lib/retornos-parse";
import { buildNeutraFromBase } from "../src/lib/neutra-engine";

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
  const parsed = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const id =
    process.env.GOOGLE_SHEETS_D1_ID?.trim() ||
    "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: [
      "'BASE IAT'!A1:EB",
      "EQUIPE!A1:F40",
      "'PAINEL OK'!A1:J200",
      "'HISTÓRICO TÉCNICO'!A1:L400",
      "RETORNOS!A1:V250",
      "'BASE NEUTRA'!A1:Z",
      "'PROMPT NEUTRA'!A1:Z",
      "'EQUIPE NEUTRA'!A1:H80",
    ],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const baseRows = ranges[0]?.values || [];
  const eqRows = ranges[1]?.values || [];
  const painelOkRows = ranges[2]?.values || [];
  const histRows = ranges[3]?.values || [];
  const retRows = ranges[4]?.values || [];
  const neutraBase = ranges[5]?.values || [];
  const neutraPrompt = ranges[6]?.values || [];
  const neutraEq = ranges[7]?.values || [];

  const set = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "2026-09",
  });
  assert(
    set.meses_disponiveis.includes("2026-09"),
    `IAT meses inclui 2026-09 got ${set.meses_disponiveis.join(",")}`,
  );
  const setTot = set.resumo.find((r) => r.base === "TOTAL");
  assert(
    (setTot?.produtivas || 0) > 0,
    `IAT SET produtivas > 0 got ${setTot?.produtivas}`,
  );

  const ok = parsePainelOk(painelOkRows);
  assert(ok.resumo != null, "PAINEL OK resumo");
  assert(
    ok.resumo?.contratos_ok.total === 369,
    `PAINEL OK contratos_ok=369 got ${ok.resumo?.contratos_ok.total}`,
  );

  const hist = parseHistoricoTecnico(histRows);
  assert(hist.cards.length >= 10, `Hist cards ≥10 got ${hist.cards.length}`);
  const gabCard = hist.cards.find((c) =>
    c.tecnico.toUpperCase().includes("GABRIEL"),
  );
  assert(gabCard?.vinculo === "PJ", `Gabriel card PJ got ${gabCard?.vinculo}`);
  const pj = hist.cards.filter((c) => c.vinculo.toUpperCase() === "PJ");
  const clt = hist.cards.filter((c) => c.vinculo.toUpperCase() !== "PJ");
  assert(
    pj[0]?.tecnico.toUpperCase().includes("GILMAR") && pj[0]?.atividades === 169,
    `PJ 1º Gilmar 169 got ${pj[0]?.tecnico} ${pj[0]?.atividades}`,
  );
  assert(
    pj[pj.length - 1]?.tecnico.toUpperCase().includes("LEANDRO") &&
      pj[pj.length - 1]?.atividades === 96,
    `PJ último Leandro 96 got ${pj[pj.length - 1]?.tecnico} ${pj[pj.length - 1]?.atividades}`,
  );
  assert(
    clt[0]?.tecnico.toUpperCase().includes("MARCUS") &&
      clt[0]?.atividades === 126,
    `CLT 1º Marcus 126 got ${clt[0]?.tecnico} ${clt[0]?.atividades}`,
  );
  assert(
    clt[clt.length - 1]?.tecnico.toUpperCase().includes("ALEXANDRE") &&
      clt[clt.length - 1]?.atividades === 64,
    `CLT último Alexandre 64 got ${clt[clt.length - 1]?.tecnico} ${clt[clt.length - 1]?.atividades}`,
  );

  const ret = parseRetornosSheet(retRows);
  assert(
    ret.resumo.total_retornos === 102,
    `Retornos 102 got ${ret.resumo.total_retornos}`,
  );
  assert(
    ret.resumo.contratos === 91,
    `Contratos 91 got ${ret.resumo.contratos}`,
  );
  assert(
    ret.resumo.sem_historico === 8,
    `Sem histórico 8 got ${ret.resumo.sem_historico}`,
  );
  assert(
    ret.com_historico.length + ret.sem_historico.length === 102,
    `linhas 102 got ${ret.com_historico.length + ret.sem_historico.length}`,
  );

  const eq = parseEquipe(eqRows);
  const gab = eq.find((e) => e.nome.toUpperCase().includes("GABRIEL"));
  assert(gab?.tipo === "PJ", `Gabriel EQUIPE→PJ got ${gab?.tipo}`);

  const merged = [
    neutraBase[0] || neutraPrompt[0],
    ...neutraBase.slice(1),
    ...neutraPrompt.slice(1),
  ];
  const neutra = buildNeutraFromBase({
    baseRows: merged,
    equipeRows: neutraEq,
    mes: "2026-11",
  });
  assert(
    neutra.resumo?.produtivas === 925,
    `Neutra mês produtivas=925 got ${neutra.resumo?.produtivas}`,
  );
  assert(
    neutra.resumo?.improdutivas === 379,
    `Neutra mês improd=379 got ${neutra.resumo?.improdutivas}`,
  );
  const day17 = neutra.visao_dia?.total?.por_dia?.[16] ?? -1;
  assert(day17 === 60, `Neutra dia 17 = 60 got ${day17}`);

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
