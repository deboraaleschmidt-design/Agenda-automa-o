/**
 * Aceite Etapa 2 — BASE IAT → /iat (nov = RESUMO aba; OK/RETORNO até 08/11).
 * Run: npx --yes tsx scripts/etapa2-iat-aceite-smoke.ts
 */
import { google } from "googleapis";
import { buildIatFromBase } from "../src/lib/iat-base-engine";

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
  const id = "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: ["'BASE IAT'!A1:DO", "EQUIPE!A1:F40"],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const baseRows = ranges[0]?.values || [];
  const eqRows = ranges[1]?.values || [];

  const nov = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "2026-11",
  });
  const tot = nov.resumo.find((r) => r.base === "TOTAL");
  assert(tot?.produtivas === 241, `nov produtivas=241 got ${tot?.produtivas}`);
  assert(tot?.improdutivas === 52, `nov improd=52 got ${tot?.improdutivas}`);
  assert(
    Math.abs((tot?.pct_produtivas || 0) - 0.823) < 0.002,
    `nov %≈82,3% got ${tot?.pct_produtivas}`,
  );
  assert(nov.blocos.length === 4, `nov 4 blocos got ${nov.blocos.length}`);
  assert(nov.ranking.length > 0, "nov ranking preenchido");

  const set = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "2026-09",
  });
  // set≥22/09 pode estar vazio na BASE atual — ainda assim blocos existem (vazios ok se 0)
  assert(set.mes === "2026-09", "set mes tag");
  console.log(
    "INFO set resumo TOTAL",
    set.resumo.find((r) => r.base === "TOTAL"),
  );

  const out = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "2026-10",
  });
  const outTot = out.resumo.find((r) => r.base === "TOTAL");
  assert(
    (outTot?.produtivas || 0) > 0 && (outTot?.improdutivas || 0) > 0,
    `out preenchido got ${outTot?.produtivas}/${outTot?.improdutivas}`,
  );
  assert(out.blocos.some((b) => b.tecnicos.length > 0), "out grades preenchidas");
  assert(out.painel_ok.resumo != null, "out PAINEL OK");
  assert(out.retorno.resumo != null, "out RETORNO");

  const hist = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "TOTAL",
  });
  const h = hist.resumo.find((r) => r.base === "TOTAL");
  const expectP = (set.resumo.find((r) => r.base === "TOTAL")?.produtivas || 0) +
    (outTot?.produtivas || 0) +
    (tot?.produtivas || 0);
  const expectI = (set.resumo.find((r) => r.base === "TOTAL")?.improdutivas || 0) +
    (outTot?.improdutivas || 0) +
    (tot?.improdutivas || 0);
  assert(
    h?.produtivas === expectP && h?.improdutivas === expectI,
    `TOTAL=soma meses ${expectP}/${expectI} got ${h?.produtivas}/${h?.improdutivas}`,
  );

  const okAte = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "2026-11",
    ate: "2026-11-08",
  });
  assert(
    okAte.painel_ok.resumo?.contratos_ok.total === 149,
    `OK E6=149 got ${okAte.painel_ok.resumo?.contratos_ok.total}`,
  );
  assert(
    okAte.painel_ok.resumo?.improdutivas.total === 33,
    `OK E7=33 got ${okAte.painel_ok.resumo?.improdutivas.total}`,
  );
  assert(
    Math.abs((okAte.painel_ok.resumo?.pct_painel.total || 0) - 0.819) < 0.002,
    `OK E14≈81,9% got ${okAte.painel_ok.resumo?.pct_painel.total}`,
  );
  assert(
    okAte.retorno.resumo?.retornos_concluidos.total === 16,
    `RET 16 got ${okAte.retorno.resumo?.retornos_concluidos.total}`,
  );
  assert(
    okAte.retorno.ofensores[0]?.tecnico.includes("DEIVISON"),
    `1º ofensor DEIVISON got ${okAte.retorno.ofensores[0]?.tecnico}`,
  );
  assert(
    okAte.retorno.ofensores[0]?.retornos === 3,
    `DEIVISON retornos=3 got ${okAte.retorno.ofensores[0]?.retornos}`,
  );
  assert(
    okAte.retorno.motivos[0]?.codigo === "527",
    `motivo top 527 got ${okAte.retorno.motivos[0]?.codigo}`,
  );

  const gab = hist.equipe.find((e) => e.nome.toUpperCase().includes("GABRIEL"));
  assert(Boolean(gab), "Gabriel na EQUIPE");
  console.log(
    "INFO Gabriel tipo na EQUIPE:",
    gab?.tipo,
    "(planilha; não inventar PJ)",
  );
  if (okAte.regras_irreprodutiveis.length) {
    console.log("INFO regras/UI não clonadas:", okAte.regras_irreprodutiveis.join(" | "));
  }

  if (fails.length) {
    console.error("FAIL\n" + fails.join("\n"));
    process.exit(1);
  }
  console.log("Etapa 2 aceite smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
