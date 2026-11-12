/**
 * Aceite Etapa 1: números do parser × células PAINEL (snapshot lido 12/11).
 * Run: npx --yes tsx scripts/etapa1-aceite-smoke.ts
 */
import {
  parseCidadesFromPainel,
  parseGradeFromPainel,
  parseKpisFromPainel,
  parseTiposFromPainel,
  resolveKpisForMes,
  resolveTiposForMes,
} from "../src/lib/painel-parse";

/** Snapshot PAINEL (mesmas células do MCP 12/11/2026). */
const rows: unknown[][] = [
  ["DESCONEXÃO E RETIRADA — CLARO / TCI"],
  ["Atualizado · NOVEMBRO/2026 · v18 BASE+PAINEL · sem chart no Atualizar"],
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
  [1757, "", "", "", "", "", "", "", 1470, "", "", "", "", "", "", "", 287, "", "", "", "", "", "", "", 0.837],
  ["▶ Preso Atlas"],
  ["ACOMPANHAMENTO — NOVEMBRO/2026 — POR DIA"],
  ["Legenda: Z698465=Guilherme (CLT) · Z698466=Alexandre (CLT) · SMA=Valter · TCI"],
  ["TÉCNICO", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, "TOT"],
  ["Z698465", 0, 0, 0, 9, 8, 2, 6, 0, 5, 5, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 39],
  ["Z698466", 0, 0, 3, 4, 2, 13, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 27],
  ["SMA", 0, 0, 5, 2, 8, 8, 3, 0, 2, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33],
  ["TCI", 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  ["TOTAL", 0, 0, 8, 15, 19, 23, 10, 0, 7, 7, 10, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 101],
  ["Seriais duplicados desconsiderados: 6 (mantido o último registro)"],
  ["RECOLHAS POR CIDADE × MÊS"],
  ["CIDADE", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ", "TOTAL"],
  ["SANTA MARIA", 0, 0, 27, 144, 119, 93, 113, 112, 110, 90, 26, 0, 834],
  ["CANOAS", 0, 0, 0, 0, 0, 0, 7, 54, 121, 206, 41, 0, 429],
  ["PORTO ALEGRE", 1, 0, 43, 4, 27, 3, 1, 29, 107, 145, 34, 0, 394],
  ["TOTAL", 1, 0, 78, 177, 155, 118, 128, 199, 354, 445, 101, 0, 1756],
  ["EVOLUÇÃO MENSAL (recolhas)"],
  ["MÊS", "RECOLHAS"],
  ["JAN", 1],
  ["NOV", 101],
  ["TOTAL POR TIPO DE SERVIÇO — desde AGO/2026"],
  ["Linhas de Respostas…"],
  ["MÊS", "RETIRADA", "DESCONEXÃO", "TROCA PACOTE/TECNOLOGIA", "INSTALAÇÃO", "", "", "VERIFICAR", "", "", "CONTROLE", "", "", "REINSTALAÇÃO", "", "TOTAL"],
  ["ago./2026", 135, 0, 3, 0, "", "", 61, "", "", 0, "", "", 0, "", 199],
  ["set./2026", 212, 69, 43, 28, "", "", 0, "", "", 2, "", "", 0, "", 354],
  ["out./2026", 200, 159, 42, 43, "", "", 0, "", "", 0, "", "", 1, "", 445],
  ["nov./2026", 57, 15, 14, 15, "", "", 0, "", "", 0, "", "", 0, "", 101],
  ["TOTAL desde AGO/2026", 604, 243, 102, 86, "", "", 61, "", "", 2, "", "", 1, "", 1099],
  ["Antes de AGO/2026 (histórico · só retirada)", 658, 0, 0, 0, "", "", 0, "", "", 0, "", "", 0, "", 658],
  ["TOTAL GERAL (linhas com SERIAL)", 1262, 243, 102, 86, "", "", 61, "", "", 2, "", "", 1, "", 1757],
];

const fails: string[] = [];
function assert(cond: boolean, msg: string) {
  if (!cond) fails.push(msg);
  else console.log("OK", msg);
}

const kpisTotal = resolveKpisForMes(rows, [], "TOTAL");
assert(kpisTotal.recolhidos === 1757, `TOTAL recolhidos=1757 (A4) got ${kpisTotal.recolhidos}`);
assert(kpisTotal.entregues === 1470, `TOTAL entregues=1470 (I4) got ${kpisTotal.entregues}`);
assert(kpisTotal.em_processo === 287, `TOTAL em_processo=287 (Q4) got ${kpisTotal.em_processo}`);
assert(
  Math.abs(kpisTotal.pct_entregue - 0.837) < 0.001,
  `TOTAL pct≈83,7% got ${kpisTotal.pct_entregue}`,
);
assert(kpisTotal.escopo === "cabecalho", "TOTAL escopo=cabecalho");

const kpisNov = resolveKpisForMes(rows, [], "2026-11");
assert(kpisNov.recolhidos === 101, `NOV recolhas=101 (cidade/evo) got ${kpisNov.recolhidos}`);
assert(kpisNov.escopo === "mes", "NOV escopo=mes");

const grade = parseGradeFromPainel(rows);
assert(grade.totais[0] === 39, `Guilherme TOT=39 got ${grade.totais[0]}`);
assert(grade.totais[1] === 27, `Alexandre TOT=27 got ${grade.totais[1]}`);
assert(grade.totais[2] === 33, `Valter TOT=33 got ${grade.totais[2]}`);
assert(grade.totais[3] === 2, `TCI TOT=2 got ${grade.totais[3]}`);
assert(
  grade.notaDuplicados.toLowerCase().includes("duplicados"),
  "nota duplicados presente",
);

const cidades = parseCidadesFromPainel(rows);
const sm = cidades.por_cidade_mes.find((c) => c.cidade === "SANTA MARIA");
assert(sm?.meses.NOV === 26, `SANTA MARIA NOV=26 got ${sm?.meses.NOV}`);
assert(sm?.total === 834, `SANTA MARIA TOTAL=834 got ${sm?.total}`);
assert(
  cidades.evolucao_mensal.find((e) => e.mes === "NOV")?.recolhas === 101,
  "evo NOV=101",
);

const tiposNov = resolveTiposForMes(rows, "2026-11");
assert(tiposNov.total === 101, `tipos NOV total=101 got ${tiposNov.total}`);
const retirada = tiposNov.itens.find((t) => t.tipo.includes("RETIRADA"));
assert(retirada?.quantidade === 57, `tipos NOV RETIRADA=57 got ${retirada?.quantidade}`);

const tiposTotal = resolveTiposForMes(rows, "TOTAL");
assert(tiposTotal.total === 1099, `tipos TOTAL desde AGO=1099 got ${tiposTotal.total}`);

const header = parseKpisFromPainel(rows);
assert(header.recolhidos === 1757, "parseKpis A4");

const tiposRaw = parseTiposFromPainel(rows);
assert(tiposRaw.totalGeralSum === 1757, `TOTAL GERAL tipos=1757 got ${tiposRaw.totalGeralSum}`);

if (fails.length) {
  console.error("FAILS:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("\nAceite smoke: todos os asserts OK");
