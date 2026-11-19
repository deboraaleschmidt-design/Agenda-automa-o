/**
 * Smoke MVP IAT + Financeiro parsers (no Sheets call).
 * Run: npx --yes tsx scripts/mvp-smoke.ts
 */
import { buildDesconexaoQuinzena } from "../src/lib/finance-opex";
import { parseAPagar, parseFaturamento } from "../src/lib/finance-parse";
import { parseIatSheet } from "../src/lib/iat-parse";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

const iatRows: unknown[][] = [
  ["PRODUTIVAS E IMPRODUTIVAS POR DIA — IAT — NOVEMBRO 2026"],
  ["Legenda"],
  [],
  ["PRODUTIVAS (CONTRATOS OK) — CANOAS"],
  ["", "DOM", "SEG"],
  ["Técnico", 1, 2, 3],
  ["CLAUBER", 0, 0, 4],
  ["GILMAR", 0, 0, 3],
  ["TOTAL CANOAS", 0, 0, 7],
  [],
  ["IMPRODUTIVAS — CANOAS"],
  ["", "DOM", "SEG"],
  ["Técnico", 1, 2, 3],
  ["CLAUBER", 0, 0, 1],
  ["TOTAL CANOAS", 0, 0, 1],
  [],
  ["RESUMO POR CONTRATO"],
  ["Base", "Produtivas", "", "", "", "", "", "Improdutivas"],
  ["CANOAS", 7, "", "", "", "", "", 1],
  ["PORTO ALEGRE", 0, "", "", "", "", "", 0],
  ["TOTAL IAT", 7, "", "", "", "", "", 1],
];

const iat = parseIatSheet(iatRows);
if (iat.blocos.length < 2) fail(`blocos=${iat.blocos.length}`);
const canoasProd = iat.resumo.find((r) => r.base === "CANOAS");
if (!canoasProd || canoasProd.produtivas !== 7) {
  fail(`resumo canoas=${JSON.stringify(canoasProd)}`);
}

const pagarRows: unknown[][] = [
  ["PAINEL DE RECOLHAS — A PAGAR · QUINZENA 1"],
  ["regras"],
  [],
  ["Técnico", "Recolhas", "Unitário", "A PAGAR", "Status"],
  ["VALTER BECKER", 30, "R$ 20,00", "R$ 600,00", "A PAGAR"],
  ["GILMAR PIRES", 1, "R$ 15,00", "R$ 15,00", "A PAGAR"],
  ["TOTAL A PAGAR (quinzena)", 31, "", "R$ 615,00"],
];
const pagar = parseAPagar(pagarRows);
if (pagar.linhas.length !== 2) fail(`pagar linhas=${pagar.linhas.length}`);
if (Math.abs(pagar.total - 615) > 0.01) fail(`pagar total=${pagar.total}`);
if (pagar.quinzena !== 1) fail(`pagar quinzena=${pagar.quinzena}`);

const multiRows: unknown[][] = [
  ["PAINEL DE RECOLHAS — NOVEMBRO/2026 · QUINZENA 2 · VALTER corte"],
  ["regras"],
  [],
  ["FECHAMENTO DO PAGAMENTO — até o corte"],
  [
    "Técnico",
    "Período",
    "Recolhas",
    "Unitário",
    "Total a pagar",
    "Já marcadas PAGO",
    "Sem PAGO",
    "Situação",
  ],
  [
    "VALTER BECKER",
    "01/11–17/11 12:30 (corte)",
    "R$ 55,00",
    "R$ 20,00",
    "R$ 1.100,00",
    "",
    "1",
    "PARCIAL",
  ],
  [
    "JULIANO BARCELLOS",
    "01/11–15/11",
    "R$ 8,00",
    "R$ 15,00",
    "R$ 120,00",
    "",
    "0",
    "PAGO TUDO",
  ],
  ["TOTAL DO FECHAMENTO", "", "", "", "R$ 1.220,00"],
  [],
  ["FECHADAS — A PAGAR (EM ATRASO)"],
  [
    "Técnico",
    "Período",
    "Recolhas",
    "Unitário",
    "A pagar",
    "Fechou em",
    "Dias em atraso",
    "Status",
  ],
  [
    "VALTER BECKER",
    "01/11–17/11 12:30 (corte)",
    "1",
    "R$ 20,00",
    "R$ 20,00",
    "17/11/2026 12:30",
    "2",
    "EM ATRASO",
  ],
  ["TOTAL EM ATRASO", "", "1", "", "R$ 20,00"],
  [],
  ["QUINZENA VIGENTE 2 · 16/11/2026 a 30/11/2026"],
  ["Técnico", "Recolhas em aberto", "Unitário", "A PAGAR", "Status"],
  ["VALTER BECKER", "10", "R$ 20,00", "R$ 200,00", "A PAGAR · pós-corte"],
  ["TOTAL A PAGAR (quinzena)", "10", "", "R$ 200,00"],
];
const multi = parseAPagar(multiRows);
if (multi.quinzena !== 2) fail(`multi quinzena=${multi.quinzena}`);
if (multi.fechamento.length !== 2)
  fail(`multi fechamento=${multi.fechamento.length}`);
if (multi.fechamento[0].volume !== 55)
  fail(`multi valter vol fech=${multi.fechamento[0].volume}`);
if (Math.abs(multi.fechamento[0].valor - 1100) > 0.01)
  fail(`multi valter valor fech=${multi.fechamento[0].valor}`);
if (multi.em_atraso.length !== 1 || multi.em_atraso[0].volume !== 1)
  fail(`multi atraso=${JSON.stringify(multi.em_atraso)}`);
if (multi.vigente.length !== 1 || multi.vigente[0].volume !== 10)
  fail(`multi vigente=${JSON.stringify(multi.vigente)}`);
if (Math.abs(multi.total - 200) > 0.01) fail(`multi total=${multi.total}`);

const q = buildDesconexaoQuinzena(multi, 2026, 11);
if (q.q1.length !== 2) fail(`q1 n=${q.q1.length}`);
if (q.q2.length !== 1) fail(`q2 n=${q.q2.length}`);
if (q.q2[0].atividades !== 10 || Math.abs((q.q2[0].valor || 0) - 200) > 0.01) {
  fail(`q2 valter=${JSON.stringify(q.q2[0])}`);
}
if (q.q1[0].atividades !== 55) fail(`q1 ativ=${q.q1[0].atividades}`);

const fatRows: unknown[][] = [
  ["FATURAR"],
  [],
  ["FOCO"],
  ["RECOLHAS AGO+", 1000, "FATURAMENTO AGO+", "R$ 40.000,00"],
  [],
  ["MÊS", "RECOLHAS", "FATURAMENTO (R$)", "UNIT.", "PERÍODO"],
  ["outubro/2026", 445, "R$ 17.558,30", "R$ 39,46", "AGO+"],
  ["TOTAL GERAL", 1745, "R$ 70.000,00", "R$ 40,00"],
];
const fat = parseFaturamento(fatRows);
if (fat.meses.length !== 1) fail(`fat meses=${fat.meses.length}`);
if (fat.agoMais.recolhas !== 1000) fail(`ago+=${fat.agoMais.recolhas}`);
if (Math.abs(fat.meses[0].faturamento - 17558.3) > 0.01) {
  fail(`out fat=${fat.meses[0].faturamento}`);
}

console.log("mvp-smoke OK", {
  iatBlocos: iat.blocos.length,
  pagar: pagar.total,
  fatOut: fat.meses[0].faturamento,
});
