/**
 * Aceite Neutra — Nov/2026 vs validação do pedido.
 * Run: npx --yes tsx scripts/etapa-neutra-aceite-smoke.ts
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
  // Env antes de importar módulos que leem SPREADSHEET_NEUTRA_ID.
  if (
    !process.env.GOOGLE_SHEETS_NEUTRA_ID?.trim() &&
    !process.env.GOOGLE_SHEETS_D1_ID?.trim()
  ) {
    process.env.GOOGLE_SHEETS_NEUTRA_ID =
      "1u8Ng_a0Pu2eO2FfzJFGJ1bF4s6wldkkfMU7AoGAyUVM";
    console.log("smoke: set GOOGLE_SHEETS_NEUTRA_ID for this process only");
  }

  const { buildNeutraFromBase } = await import("../src/lib/neutra-engine");
  const { syncFinanceiro } = await import("../src/lib/finance-sync");

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
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: ["'BASE NEUTRA'!A1:Z", "'EQUIPE NEUTRA'!A1:H80"],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const ranges = res.data.valueRanges || [];
  const built = buildNeutraFromBase({
    baseRows: ranges[0]?.values || [],
    equipeRows: ranges[1]?.values || [],
    mes: "2026-11",
  });
  const r = built.resumo;
  assert(r.tecnicos === 24, `tecnicos=24 got ${r.tecnicos}`);
  assert(r.produtivas === 865, `prod=865 got ${r.produtivas}`);
  assert(r.improdutivas === 354, `improd=354 got ${r.improdutivas}`);
  assert(
    Math.abs(r.pct_sucesso - 0.71) < 0.002,
    `% sucesso≈71,0% got ${(r.pct_sucesso * 100).toFixed(1)}`,
  );
  assert(
    r.tempo_medio_label === "1:04",
    `tempo 1:04 got ${r.tempo_medio_label}`,
  );
  assert(
    Math.abs(r.reaprov_pct - 0.529) < 0.002,
    `reaprov≈52,9% got ${(r.reaprov_pct * 100).toFixed(1)}`,
  );
  assert(r.dias_atividade === 13, `dias=13 got ${r.dias_atividade}`);
  assert(
    r.inst_mud_com_drop === 450 && r.inst_mud_sem_drop === 405,
    `INST+MUD 450/405 got ${r.inst_mud_com_drop}/${r.inst_mud_sem_drop}`,
  );
  assert(
    Math.abs(r.valor_inst_mud - 136350) < 0.01,
    `valor R$136.350 got ${r.valor_inst_mud}`,
  );
  assert(
    built.avisos.some((a) => a.toLowerCase().includes("mesh")),
    "aviso mesh",
  );
  assert(
    built.tecnicos.every((t) => !/\bTT\d+|\bTR\d+/.test(t.nome)),
    "UI nome sem matrícula",
  );

  const vd = built.visao_dia;
  assert(!!vd, "visao_dia presente em Nov");
  if (vd) {
    assert(vd.cols.length === 30, `cols Nov=30 got ${vd.cols.length}`);
    assert(
      vd.cols[14]?.fechamento === "1a",
      `dia 15 fechamento 1a got ${vd.cols[14]?.fechamento}`,
    );
    assert(
      vd.cols[29]?.fechamento === "2a",
      `dia 30 fechamento 2a got ${vd.cols[29]?.fechamento}`,
    );
    assert(
      vd.total.produtivas === 865,
      `visao total prod=865 got ${vd.total.produtivas}`,
    );
    assert(
      vd.total.improdutivas === 354,
      `visao total improd=354 got ${vd.total.improdutivas}`,
    );
    assert(
      vd.total.q1 + vd.total.q2 === 865,
      `q1+q2=865 got ${vd.total.q1}+${vd.total.q2}`,
    );
    console.log(
      `QUINZENAS Nov: 1ª=${vd.total.q1} 2ª=${vd.total.q2} · pag PJ ${vd.pagamento.q1_pago_em} / ${vd.pagamento.q2_pago_em}`,
    );
    // 20/11/2026 = feriado Consciência Negra → 1º útil = 21/11 (sáb conta)
    assert(
      vd.pagamento.q1_pago_em === "21/11/2026",
      `pag 1ª=21/11/2026 got ${vd.pagamento.q1_pago_em}`,
    );
    // 05/12/2026 = sábado → conta como dia útil
    assert(
      vd.pagamento.q2_pago_em === "05/12/2026",
      `pag 2ª=05/12/2026 got ${vd.pagamento.q2_pago_em}`,
    );
    const clts = vd.rows.filter((r) => !r.is_pj);
    assert(
      clts.length >= 3,
      `≥3 CLT na visão got ${clts.length}`,
    );
  }

  const fin = await syncFinanceiro({ mes: "2026-11", segmento: "neutra" });
  assert(fin.status === "ok", `fin status ok got ${fin.status}`);
  assert(
    Math.abs(fin.subtotais.neutra.valor_faturar - 136350) < 0.02,
    `fin Neutra R$136.350 got ${fin.subtotais.neutra.valor_faturar}`,
  );
  const com = fin.atividades.find((a) => a.codigo === "INST-MUD-COM-DROP");
  const sem = fin.atividades.find((a) => a.codigo === "INST-MUD-SEM-DROP");
  assert(com?.quantidade === 450, `fin com drop 450 got ${com?.quantidade}`);
  assert(sem?.quantidade === 405, `fin sem drop 405 got ${sem?.quantidade}`);
  // 10 SRV sem preço não entram no OK TCI; INST+MUD por técnico = 24
  assert(
    (fin.ok_tci_tecnicos || []).length === 24,
    `ok tci 24 techs got ${fin.ok_tci_tecnicos?.length}`,
  );

  if (fails.length) {
    console.error("FAILS:\n" + fails.join("\n"));
    process.exit(1);
  }
  console.log("\nNeutra Nov aceite OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
