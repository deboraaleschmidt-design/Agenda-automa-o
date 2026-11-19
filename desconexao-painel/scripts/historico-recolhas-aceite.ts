/**
 * Aceite HISTÓRICO RECOLHAS (pedido 19/11) — NOV/OUT/SET + quinzenas.
 * Run: npx --yes tsx scripts/historico-recolhas-aceite.ts
 */
import { buildDesconexaoQuinzena } from "../src/lib/finance-opex";
import {
  historicoToAPagarParse,
  parseHistoricoRecolhas,
} from "../src/lib/finance-parse";
import { syncFinanceiro } from "../src/lib/finance-sync";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

async function main() {
  // Fixture espelho do dump live 19/11
  const rows: unknown[][] = [
    ["HISTÓRICO RECOLHAS — desde 01/09/2026 · atualizado em 19/11/2026"],
    ["regras v20.10"],
    [],
    ["novembro/2026"],
    [
      "Período",
      "Técnico",
      "Classificação",
      "Recolhas",
      "Unitário",
      "Valor",
      "Pagas (PAGO)",
      "Não pagas",
      "Status",
    ],
    [
      "17/11 12:30 a hoje (aberto)",
      "VALTER BECKER",
      "VALTER R$ 20",
      "10",
      "R$ 20,00",
      "R$ 200,00",
      "0",
      "10",
      "EM ABERTO",
    ],
    [
      "01/11–17/11 12:30 (corte)",
      "VALTER BECKER",
      "VALTER R$ 20",
      "55",
      "R$ 20,00",
      "R$ 1.100,00",
      "54",
      "1",
      "PARCIAL",
    ],
    [
      "01/11–15/11",
      "JULIANO BARCELLOS",
      "PJ R$ 15",
      "8",
      "R$ 15,00",
      "R$ 120,00",
      "8",
      "0",
      "PAGO",
    ],
    [
      "01/11–15/11",
      "CLAUBER TEXEIRA",
      "PJ R$ 15",
      "1",
      "R$ 15,00",
      "R$ 15,00",
      "1",
      "0",
      "PAGO",
    ],
    [
      "01/11–15/11",
      "GILMAR PIRES",
      "PJ R$ 15",
      "1",
      "R$ 15,00",
      "R$ 15,00",
      "1",
      "0",
      "PAGO",
    ],
    [
      "Subtotal NOVEMBRO/2026",
      "",
      "",
      "75",
      "",
      "R$ 1.450,00",
      "64",
      "11",
      "Pago R$ 1230.00 · Em aberto R$ 220.00",
    ],
    [],
    ["outubro/2026"],
    [
      "Período",
      "Técnico",
      "Classificação",
      "Recolhas",
      "Unitário",
      "Valor",
      "Pagas (PAGO)",
      "Não pagas",
      "Status",
    ],
    [
      "16/10–31/10",
      "VALTER BECKER",
      "VALTER R$ 20",
      "65",
      "R$ 20,00",
      "R$ 1.300,00",
      "65",
      "0",
      "PAGO",
    ],
    [
      "Subtotal OUTUBRO/2026",
      "",
      "",
      "106",
      "",
      "R$ 2.035,00",
      "106",
      "0",
      "Pago R$ 2035.00 · Em aberto R$ 0.00",
    ],
    [],
    ["setembro/2026"],
    [
      "Período",
      "Técnico",
      "Classificação",
      "Recolhas",
      "Unitário",
      "Valor",
      "Pagas (PAGO)",
      "Não pagas",
      "Status",
    ],
    [
      "16/09–30/09",
      "VALTER BECKER",
      "VALTER R$ 20",
      "63",
      "R$ 20,00",
      "R$ 1.260,00",
      "63",
      "0",
      "PAGO",
    ],
    [
      "Subtotal SETEMBRO/2026",
      "",
      "",
      "113",
      "",
      "R$ 2.250,00",
      "113",
      "0",
      "Pago R$ 2250.00 · Em aberto R$ 0.00",
    ],
    [],
    [
      "TOTAL desde 01/09/2026",
      "",
      "",
      "294",
      "",
      "R$ 5.735,00",
      "283",
      "11",
      "Pago R$ 5515.00 · Em aberto R$ 220.00",
    ],
  ];

  const hist = parseHistoricoRecolhas(rows);
  const nov = hist.meses.find((m) => m.mes_ym === "2026-11");
  const out = hist.meses.find((m) => m.mes_ym === "2026-10");
  const set = hist.meses.find((m) => m.mes_ym === "2026-09");
  if (!nov || !out || !set) fail("meses missing");
  if (nov.recolhas !== 75 || !near(nov.valor, 1450))
    fail(`nov sub ${nov.recolhas}/${nov.valor}`);
  if (!near(nov.pago_valor, 1230) || !near(nov.aberto_valor, 220))
    fail(`nov pago/aberto ${nov.pago_valor}/${nov.aberto_valor}`);
  if (!near(out.valor, 2035) || out.aberto_valor !== 0)
    fail(`out ${out.valor}/${out.aberto_valor}`);
  if (!near(set.valor, 2250) || set.aberto_valor !== 0)
    fail(`set ${set.valor}/${set.aberto_valor}`);
  if (!hist.total || hist.total.recolhas !== 294 || !near(hist.total.valor, 5735))
    fail(`total ${JSON.stringify(hist.total)}`);
  if (!near(hist.total.pago_valor, 5515) || !near(hist.total.aberto_valor, 220))
    fail(`total pago/ab ${hist.total.pago_valor}/${hist.total.aberto_valor}`);

  const pack = historicoToAPagarParse(hist, "2026-11");
  const q = buildDesconexaoQuinzena(pack, 2026, 11);
  const vQ1 = q.q1.find((l) => /valter/i.test(l.tecnico));
  const vQ2 = q.q2.find((l) => /valter/i.test(l.tecnico));
  if (!vQ1 || vQ1.atividades !== 55 || !near(vQ1.valor || 0, 1100))
    fail(`q1 valter ${JSON.stringify(vQ1)}`);
  if (!vQ2 || vQ2.atividades !== 10 || !near(vQ2.valor || 0, 200))
    fail(`q2 valter ${JSON.stringify(vQ2)}`);
  if (q.q1.some((l) => l.atividades === 0 && (l.valor || 0) > 0))
    fail("ativ=0 com valor na Q1");
  const pendTot = pack.em_atraso.reduce((s, l) => s + l.valor, 0);
  if (!near(pendTot, 220)) fail(`pendente ${pendTot} ${JSON.stringify(pack.em_atraso)}`);

  console.log("fixture OK");

  // Live
  const live = await syncFinanceiro({ mes: "2026-11", segmento: "desconexao" });
  if (live.status !== "ok") fail(`live status ${live.status} ${live.mensagem}`);
  const lq1 = live.pagamento_quinzenas[0]?.linhas || [];
  const lq2 = live.pagamento_quinzenas[1]?.linhas || [];
  const lv1 = lq1.find((l) => /valter/i.test(l.tecnico));
  const lv2 = lq2.find((l) => /valter/i.test(l.tecnico));
  if (!lv1 || lv1.atividades !== 55 || !near(lv1.valor || 0, 1100))
    fail(`live q1 ${JSON.stringify(lv1)}`);
  if (!lv2 || lv2.atividades !== 10 || !near(lv2.valor || 0, 200))
    fail(`live q2 ${JSON.stringify(lv2)}`);
  const aberto =
    (live.recolhas_aberto?.pendentes || []).reduce((s, l) => s + l.valor, 0);
  if (!near(aberto, 220)) fail(`live aberto ${aberto}`);
  console.log("live NOV OK", {
    q1: lq1.map((l) => `${l.tecnico}:${l.atividades}:${l.valor}`),
    q2: lq2.map((l) => `${l.tecnico}:${l.atividades}:${l.valor}`),
    aberto,
  });

  for (const [m, expectValor, expectAberto] of [
    ["2026-10", 2035, 0],
    ["2026-09", 2250, 0],
  ] as const) {
    const p = await syncFinanceiro({ mes: m, segmento: "desconexao" });
    const linhas = [
      ...(p.pagamento_quinzenas[0]?.linhas || []),
      ...(p.pagamento_quinzenas[1]?.linhas || []),
    ];
    const tot = linhas
      .filter((l) => l.tipo === "PJ" || l.tipo === "parceiro")
      .reduce((s, l) => s + (l.valor || 0), 0);
    const ab = (p.recolhas_aberto?.pendentes || []).reduce(
      (s, l) => s + l.valor,
      0,
    );
    if (!near(tot, expectValor)) fail(`${m} valor ${tot} != ${expectValor}`);
    if (!near(ab, expectAberto)) fail(`${m} aberto ${ab} != ${expectAberto}`);
    console.log(`live ${m} OK`, { tot, ab, n: linhas.length });
  }

  console.log("historico-recolhas-aceite OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
