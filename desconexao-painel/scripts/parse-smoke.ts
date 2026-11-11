/**
 * Smoke: title-based PAINEL / Respostas parsers (no Sheets call).
 * Run: npx --yes tsx scripts/parse-smoke.ts
 */
import {
  aggregateServicos,
  findRespostasHeaderIndex,
  isMesOrTotal,
  parseCidadesFromPainel,
  parseGradeFromPainel,
  parseKpisFromPainel,
  recolhidosOficiaisNoMes,
  resolveGradeForMes,
  resolveKpisForMes,
} from "../src/lib/painel-parse";

const painelRows: unknown[][] = [
  ["DESCONEXÃO E RETIRADA"],
  ["Atualizado · NOVEMBRO/2026"],
  [
    "EQUIP. RECOLHIDOS",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "ENTREGUES",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "EM PROCESSO",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "% ENTREGUE",
  ],
  [
    1739,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    956,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    783,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    0.55,
  ],
  ["▶ Preso Atlas"],
  ["ACOMPANHAMENTO — NOVEMBRO/2026 — POR DIA"],
  ["Legenda: Z698465=Guilherme"],
  ["TÉCNICO", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // Critério briefing 10/11: Guilherme 32 · Alexandre 22 · Valter 28 · TCI 2 · 84
  ["Z698465", 0, 0, 0, 9, 8, 2, 6, 0, 5, 2],
  ["Z698466", 0, 0, 3, 4, 2, 13, 0, 0, 0, 0],
  ["SMA", 0, 0, 5, 2, 8, 8, 3, 0, 2, 0],
  ["TCI", 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  ["TOTAL", 0, 0, 8, 15, 19, 23, 10, 0, 7, 2],
  ["Seriais duplicados desconsiderados: 6"],
  ["RECOLHAS POR CIDADE × MÊS"],
  [
    "CIDADE",
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
    "TOTAL",
  ],
  ["SANTA MARIA", 0, 0, 27, 144, 119, 93, 113, 112, 110, 90, 24, 0, 832],
  ["CANOAS", 0, 0, 0, 0, 0, 0, 7, 54, 121, 206, 35, 0, 423],
];

const respostas: unknown[][] = [
  [],
  [
    "FATURAR",
    "Carimbo de data/hora",
    "CONTRATO",
    "SERIAL",
    "FOTO",
    "TECNICO QUE COLETOU/ENTREGOU",
    "NOME",
    "CIDADE",
    "AGENDAMENTO",
    "EMAIL",
    "SMART",
    "SERVIÇO",
    "REGIÃO",
    "DATA",
    "STATUS PG",
    "STATUS DE ENTREGA",
  ],
  [
    "NOV2026",
    "10/11/2026 12:00",
    "1",
    "ABC123",
    "",
    "GUILHERME BECKER",
    "",
    "POA",
    "",
    "",
    "",
    "DESCONEXÃO",
    "",
    "10/11/2026",
    "PAGO",
    "ENTREGUE CLARO POA",
  ],
  [
    "AGO2026",
    "01/08/2026 12:00",
    "2",
    "DEF456",
    "",
    "VALTER BECKER",
    "",
    "POA",
    "",
    "",
    "",
    "RETIRADA",
    "",
    "01/08/2026",
    "",
    "",
  ],
  [
    "JUL2026",
    "01/07/2026 12:00",
    "3",
    "GHI789",
    "",
    "TCI",
    "",
    "POA",
    "",
    "",
    "",
    "INSTALAÇÃO",
    "",
    "01/07/2026",
    "PAGO",
    "ENTREGUE CLARO POA",
  ],
  [
    "OUT2026",
    "15/10/2026 12:00",
    "4",
    "OUT001",
    "",
    "ALEXANDRE DE JESUS",
    "",
    "POA",
    "",
    "",
    "",
    "RETIRADA",
    "",
    "15/10/2026",
    "",
    "EM PROCESSO",
  ],
  [
    "OUT2026",
    "16/10/2026 12:00",
    "5",
    "OUT002",
    "",
    "GUILHERME BECKER",
    "",
    "POA",
    "",
    "",
    "",
    "DESCONEXÃO",
    "",
    "16/10/2026",
    "PAGO",
    "ENTREGUE CLARO POA",
  ],
];

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

const kpis = parseKpisFromPainel(painelRows);
if (kpis.recolhidos !== 1739) fail(`recolhidos=${kpis.recolhidos}`);
if (kpis.entregues !== 956) fail(`entregues=${kpis.entregues}`);
if (kpis.em_processo !== 783) fail(`em_processo=${kpis.em_processo}`);
if (Math.abs(kpis.pct_entregue - 0.55) > 1e-9) fail(`pct=${kpis.pct_entregue}`);

const grade = parseGradeFromPainel(painelRows);
const sums = [0, 0, 0, 0];
for (const row of grade.dias) {
  for (let i = 0; i < 4; i++) sums[i] += row[i + 1];
}
if (sums.join(",") !== "32,22,28,2") fail(`grade sums=${sums}`);
if (sums.reduce((a, b) => a + b, 0) !== 84) fail("grade total");

const cities = parseCidadesFromPainel(painelRows);
if (cities.por_cidade_mes[0]?.cidade !== "SANTA MARIA") fail("city0");
if (cities.evolucao_mensal.length !== 12) {
  fail(`evo len=${cities.evolucao_mensal.length}`);
}
if (cities.evolucao_mensal.some((e) => !/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/.test(e.mes))) {
  fail("evo junk labels");
}

if (findRespostasHeaderIndex(respostas) !== 1) fail("header idx");
const nov = aggregateServicos(respostas, "2026-11");
if (nov.find((x) => x.tipo === "DESCONEXÃO")?.quantidade !== 1) {
  fail("nov desconexao");
}
const outTipos = aggregateServicos(respostas, "2026-10");
if (outTipos.find((x) => x.tipo === "RETIRADA")?.quantidade !== 1) {
  fail("out retirada");
}
if (outTipos.find((x) => x.tipo === "DESCONEXÃO")?.quantidade !== 1) {
  fail("out desconexao");
}
const total = aggregateServicos(respostas, "TOTAL");
if (total.find((x) => x.tipo === "RETIRADA")?.quantidade !== 2) {
  fail("total retirada");
}
if ((total.find((x) => x.tipo === "INSTALAÇÃO")?.quantidade || 0) !== 0) {
  fail("jul must be excluded from TOTAL since ago/2026");
}
if (!isMesOrTotal("TOTAL") || !isMesOrTotal("2026-11") || isMesOrTotal("foo")) {
  fail("isMesOrTotal");
}

const kpisTotal = resolveKpisForMes(painelRows, respostas, "TOTAL");
if (kpisTotal.recolhidos !== 1739) fail(`kpi TOTAL=${kpisTotal.recolhidos}`);
const outRec = recolhidosOficiaisNoMes(painelRows, "2026-10");
if (outRec !== 296) fail(`out oficiais=${outRec}`);
const kpisOut = resolveKpisForMes(painelRows, respostas, "2026-10");
if (kpisOut.recolhidos !== 296) fail(`kpi out recolhidos=${kpisOut.recolhidos}`);
if (kpisOut.entregues !== 148) fail(`kpi out entregues=${kpisOut.entregues}`);
if (kpisOut.em_processo !== 148) fail(`kpi out processo=${kpisOut.em_processo}`);

const gradeOut = resolveGradeForMes(painelRows, respostas, "2026-10");
if (gradeOut.fonteGrade !== "respostas") fail(`gradeOut fonte=${gradeOut.fonteGrade}`);
if (gradeOut.dias.length !== 2) fail(`gradeOut dias=${gradeOut.dias.length}`);
const gradeNov = resolveGradeForMes(painelRows, respostas, "2026-11");
if (gradeNov.fonteGrade !== "painel") fail(`gradeNov fonte=${gradeNov.fonteGrade}`);

console.log("parse-smoke OK", {
  kpis,
  sums,
  tiposNov: nov,
  tiposOut: outTipos,
  tiposTotal: total,
  kpisOut,
  gradeOut: gradeOut.dias,
});
