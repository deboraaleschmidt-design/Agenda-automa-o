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
    "TECNICO",
    "NOME",
    "CIDADE",
    "AGENDAMENTO",
    "EMAIL",
    "SMART",
    "SERVIÇO",
    "REGIÃO",
    "DATA",
  ],
  [
    "NOV2026",
    "10/11/2026 12:00",
    "1",
    "ABC123",
    "",
    "X",
    "",
    "POA",
    "",
    "",
    "",
    "DESCONEXÃO",
    "",
    "10/11/2026",
  ],
  [
    "AGO2026",
    "01/08/2026 12:00",
    "2",
    "DEF456",
    "",
    "X",
    "",
    "POA",
    "",
    "",
    "",
    "RETIRADA",
    "",
    "01/08/2026",
  ],
  [
    "JUL2026",
    "01/07/2026 12:00",
    "3",
    "GHI789",
    "",
    "X",
    "",
    "POA",
    "",
    "",
    "",
    "INSTALAÇÃO",
    "",
    "01/07/2026",
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

if (findRespostasHeaderIndex(respostas) !== 1) fail("header idx");
const nov = aggregateServicos(respostas, "2026-11");
if (nov.find((x) => x.tipo === "DESCONEXÃO")?.quantidade !== 1) {
  fail("nov desconexao");
}
const total = aggregateServicos(respostas, "TOTAL");
if (total.find((x) => x.tipo === "RETIRADA")?.quantidade !== 1) {
  fail("total retirada");
}
if ((total.find((x) => x.tipo === "INSTALAÇÃO")?.quantidade || 0) !== 0) {
  fail("jul must be excluded from TOTAL since ago/2026");
}
if (!isMesOrTotal("TOTAL") || !isMesOrTotal("2026-11") || isMesOrTotal("foo")) {
  fail("isMesOrTotal");
}

console.log("parse-smoke OK", {
  kpis,
  sums,
  tiposNov: nov,
  tiposTotal: total,
});
