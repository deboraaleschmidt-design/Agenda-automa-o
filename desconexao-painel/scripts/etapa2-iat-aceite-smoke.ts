/**
 * Aceite Etapa 2 — parse IAT / PAINEL OK / RETORNO vs células D-1 (12/11).
 * Run: npx --yes tsx scripts/etapa2-iat-aceite-smoke.ts
 */
import { google } from "googleapis";
import {
  parseEquipe,
  parseIatSheet,
  parsePainelOk,
  parseRetorno,
} from "../src/lib/iat-parse";

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
    ranges: [
      "IAT!A1:AH120",
      "'PAINEL OK'!A1:L120",
      "'RETORNO CREDENCIADA'!A1:L80",
      "EQUIPE!A1:F40",
    ],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const iat = parseIatSheet(ranges[0]?.values || []);
  const ok = parsePainelOk(ranges[1]?.values || []);
  const ret = parseRetorno(ranges[2]?.values || []);
  const eq = parseEquipe(ranges[3]?.values || []);

  const tot = iat.resumo.find((r) => r.base === "TOTAL");
  assert(tot?.produtivas === 241, `IAT TOTAL produtivas=241 got ${tot?.produtivas}`);
  assert(tot?.improdutivas === 52, `IAT TOTAL improd=52 got ${tot?.improdutivas}`);
  assert(
    Math.abs((tot?.pct_produtivas || 0) - 0.823) < 0.002,
    `IAT TOTAL %≈82,3% got ${tot?.pct_produtivas}`,
  );

  const can = iat.resumo.find((r) => r.base === "CANOAS");
  assert(can?.produtivas === 147, `CANOAS prod=147 got ${can?.produtivas}`);

  const alex = iat.blocos
    .find((b) => b.kind === "produtivas" && b.base === "CANOAS")
    ?.tecnicos.find((t) => t.tecnico.startsWith("ALEXSANDRO"));
  assert(alex?.total === 30, `ALEXSANDRO TOT=30 got ${alex?.total}`);

  assert(ok.resumo?.contratos_ok.total === 149, `OK E6=149 got ${ok.resumo?.contratos_ok.total}`);
  assert(ok.resumo?.improdutivas.total === 33, `OK E7=33 got ${ok.resumo?.improdutivas.total}`);
  assert(
    Math.abs((ok.resumo?.pct_painel.total || 0) - 0.819) < 0.002,
    `OK E14≈81,9% got ${ok.resumo?.pct_painel.total}`,
  );

  assert(
    ret.resumo?.retornos_concluidos.total === 16,
    `RET concluidos=16 got ${ret.resumo?.retornos_concluidos.total}`,
  );
  assert(ret.ofensores[0]?.tecnico.includes("DEIVISON"), `1º ofensor DEIVISON got ${ret.ofensores[0]?.tecnico}`);
  assert(ret.ofensores[0]?.retornos === 3, `DEIVISON retornos=3`);
  assert(ret.motivos[0]?.codigo === "527", `motivo top 527 got ${ret.motivos[0]?.codigo}`);

  const gab = eq.find((e) => e.nome.toUpperCase().includes("GABRIEL"));
  assert(!!gab, "Gabriel na EQUIPE");
  console.log("INFO Gabriel tipo na EQUIPE:", gab?.tipo, "(planilha; não inventar PJ)");

  if (fails.length) {
    console.error("FAILS:\n" + fails.join("\n"));
    process.exit(1);
  }
  console.log("\nEtapa 2 aceite smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
