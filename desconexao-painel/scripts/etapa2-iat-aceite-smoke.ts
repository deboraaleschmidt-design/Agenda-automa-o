/**
 * Aceite Etapa 2 — BASE IAT desde 01/10 → /iat.
 * Recorte até 08/11 só confere regras vs abas estáticas (site não depende delas).
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
  const totNov = nov.resumo.find((r) => r.base === "TOTAL");
  assert(totNov?.produtivas === 241, `nov produtivas=241 got ${totNov?.produtivas}`);
  assert(totNov?.improdutivas === 52, `nov improd=52 got ${totNov?.improdutivas}`);
  assert(
    Math.abs((totNov?.pct_produtivas || 0) - 0.823) < 0.002,
    `nov %≈82,3% got ${totNov?.pct_produtivas}`,
  );
  assert(nov.blocos.length === 4, `nov 4 blocos got ${nov.blocos.length}`);
  assert(nov.ranking.length > 0, "nov ranking preenchido");
  assert(
    nov.dados_ate_br === "11/11",
    `dados até 11/11 got ${nov.dados_ate_br}`,
  );
  assert(
    nov.meses_disponiveis.includes("2026-10") &&
      nov.meses_disponiveis.includes("2026-11") &&
      !nov.meses_disponiveis.includes("2026-09"),
    `meses BASE out+nov got ${nov.meses_disponiveis.join(",")}`,
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
  assert(
    (out.painel_ok.resumo?.adesao_codigos || []).length > 0,
    "out adesão códigos",
  );
  assert(out.painel_ok.resumo?.casa_predio != null, "out casa×prédio");

  const hist = buildIatFromBase({
    baseRows,
    equipeRows: eqRows,
    mes: "TOTAL",
  });
  const h = hist.resumo.find((r) => r.base === "TOTAL");
  const expectP = (outTot?.produtivas || 0) + (totNov?.produtivas || 0);
  const expectI = (outTot?.improdutivas || 0) + (totNov?.improdutivas || 0);
  assert(
    h?.produtivas === expectP && h?.improdutivas === expectI,
    `TOTAL=out+nov ${expectP}/${expectI} got ${h?.produtivas}/${h?.improdutivas}`,
  );
  assert(hist.dados_ate_br === "11/11", `TOTAL dados até got ${hist.dados_ate_br}`);

  // Conferência de regra (abas estáticas até 08/11) — site não depende delas.
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
  const cp = okAte.painel_ok.resumo?.casa_predio;
  assert(cp?.ok_casa.total === 22, `OK casa=22 got ${cp?.ok_casa.total}`);
  assert(cp?.ok_predio.total === 85, `OK predio=85 got ${cp?.ok_predio.total}`);
  assert(cp?.ok_ni.total === 42, `OK ni=42 got ${cp?.ok_ni.total}`);
  assert(
    okAte.painel_ok.resumo?.adesao_ok === 197,
    `adesao tarefas=197 got ${okAte.painel_ok.resumo?.adesao_ok}`,
  );
  assert(
    okAte.painel_ok.resumo?.migracao_ok === 40,
    `migracao tarefas=40 got ${okAte.painel_ok.resumo?.migracao_ok}`,
  );
  assert(
    okAte.painel_ok.resumo?.adesao_codigos[0]?.codigo === "43",
    `adesao top 43 got ${okAte.painel_ok.resumo?.adesao_codigos[0]?.codigo}`,
  );
  assert(
    okAte.painel_ok.resumo?.adesao_improd_codigos[0]?.codigo === "106",
    `adesao improd ofensor 106 got ${okAte.painel_ok.resumo?.adesao_improd_codigos[0]?.codigo}`,
  );
  assert(
    (okAte.painel_ok.tecnicos || []).length > 0,
    "OK por técnico preenchido",
  );
  assert(
    okAte.retorno.resumo?.retornos_concluidos.total === 16,
    `RET 16 got ${okAte.retorno.resumo?.retornos_concluidos.total}`,
  );
  assert(
    okAte.retorno.ofensores[0]?.tecnico.includes("SERGIO"),
    `1º ofensor (quem atendeu) SERGIO got ${okAte.retorno.ofensores[0]?.tecnico}`,
  );
  assert(
    okAte.retorno.ofensores[0]?.retornos === 6,
    `SERGIO retornos=6 (ate 08/11) got ${okAte.retorno.ofensores[0]?.retornos}`,
  );
  assert(
    okAte.retorno.ofensores_pai[0]?.tecnico.includes("DEIVISON"),
    `1º técnico pai DEIVISON got ${okAte.retorno.ofensores_pai[0]?.tecnico}`,
  );
  assert(
    okAte.retorno.motivos[0]?.codigo === "527",
    `motivo top 527 got ${okAte.retorno.motivos[0]?.codigo}`,
  );

  const sergioNov = nov.retorno.ofensores.find((o) =>
    o.tecnico.toUpperCase().includes("SERGIO"),
  );
  const sergioTot = hist.retorno.ofensores.find((o) =>
    o.tecnico.toUpperCase().includes("SERGIO"),
  );
  assert(
    nov.retorno.ofensores[0]?.tecnico.toUpperCase().includes("SERGIO"),
    `Nov 1º ofensor SERGIO got ${nov.retorno.ofensores[0]?.tecnico}`,
  );
  assert(
    Boolean(sergioNov) && (sergioNov?.retornos || 0) >= 11,
    `Nov SERGIO ≥11 got ${sergioNov?.retornos}`,
  );
  assert(
    hist.retorno.ofensores[0]?.tecnico.toUpperCase().includes("SERGIO"),
    `TOTAL 1º ofensor SERGIO got ${hist.retorno.ofensores[0]?.tecnico}`,
  );
  assert(
    Boolean(sergioTot) && (sergioTot?.retornos || 0) >= 15,
    `TOTAL SERGIO ≥15 got ${sergioTot?.retornos}`,
  );
  console.log(
    "INFO SERGIO quem-atendeu:",
    `Nov ${sergioNov?.pos} ${sergioNov?.retornos}`,
    `TOTAL ${sergioTot?.pos} ${sergioTot?.retornos}`,
  );
  console.log(
    "INFO SERGIO técnico-pai:",
    `Nov ${nov.retorno.ofensores_pai.find((o) => o.tecnico.toUpperCase().includes("SERGIO"))?.pos}/${nov.retorno.ofensores_pai.find((o) => o.tecnico.toUpperCase().includes("SERGIO"))?.retornos}`,
    `TOTAL ${hist.retorno.ofensores_pai.find((o) => o.tecnico.toUpperCase().includes("SERGIO"))?.pos}/${hist.retorno.ofensores_pai.find((o) => o.tecnico.toUpperCase().includes("SERGIO"))?.retornos}`,
  );

  const gab = hist.equipe.find((e) => e.nome.toUpperCase().includes("GABRIEL"));
  assert(Boolean(gab), "Gabriel na EQUIPE");
  console.log(
    "INFO Gabriel tipo na EQUIPE:",
    gab?.tipo,
    "(planilha; não inventar PJ)",
  );
  if (okAte.regras_irreprodutiveis.length) {
    console.log(
      "INFO irreprodutíveis:",
      okAte.regras_irreprodutiveis.join(" | "),
    );
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
