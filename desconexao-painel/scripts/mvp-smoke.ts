/**
 * Smoke MVP IAT + Financeiro parsers (no Sheets call).
 * Run: npx --yes tsx scripts/mvp-smoke.ts
 */
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
