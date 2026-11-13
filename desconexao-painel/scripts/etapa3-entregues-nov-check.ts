/**
 * Conferência ENTREGUES Nov/2026 — só leitura Respostas.
 * Run: npx --yes tsx scripts/etapa3-entregues-nov-check.ts
 */
import {
  findRespostasHeaderIndex,
  rowMatchesMes,
  rowMonthKey,
} from "../src/lib/painel-parse";
import { mapRespostasHeader, monthKeyFromCell } from "../src/lib/servico";
import { sheetsAuthOrNull } from "../src/lib/sheets-client";
import { SPREADSHEET_ID } from "../src/lib/types";

function isEntregue(raw: unknown): boolean {
  const u = String(raw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return u.includes("ENTREGUE");
}

async function main() {
  const auth = sheetsAuthOrNull();
  if (!auth.ok) throw new Error(auth.reason || "sem credencial");
  const res = await auth.sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ["'Respostas ao formulário 1'!A1:S"],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.valueRanges?.[0]?.values || [];
  const headerIdx = findRespostasHeaderIndex(rows);
  const map = mapRespostasHeader(rows[headerIdx] || []);
  const head = rows[headerIdx] || [];
  let diaEnt = -1;
  for (let c = 0; c < head.length; c++) {
    const h = String(head[c] || "").toUpperCase();
    if (h.includes("DIA ENTREGA")) {
      diaEnt = c;
      break;
    }
  }

  console.log("Critério KPI atual:");
  console.log(
    "  linhas com SERIAL; DATA (ou carimbo) no mês 2026-11; STATUS DE ENTREGA contém 'ENTREGUE' (casefold).",
  );
  console.log({
    statusCol: head[map.statusEntrega],
    dataCol: head[map.data],
    diaEntregaCol: diaEnt >= 0 ? head[diaEnt] : null,
  });

  const statusDist = new Map<string, number>();
  let novSerial = 0;
  let novEntregue = 0;
  let novEmptyStatus = 0;
  const samples: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    const mk = rowMonthKey(map, row);
    if (!rowMatchesMes(mk, "2026-11")) continue;
    novSerial += 1;
    const st = String(row[map.statusEntrega] ?? "").trim();
    statusDist.set(st || "(vazio)", (statusDist.get(st || "(vazio)") || 0) + 1);
    if (!st) novEmptyStatus += 1;
    if (isEntregue(st)) {
      novEntregue += 1;
      if (samples.length < 10) {
        samples.push(
          `${row[map.data]} | status=${st} | dia=${diaEnt >= 0 ? row[diaEnt] : ""}`,
        );
      }
    }
  }

  let byDiaEntNov = 0;
  let byDiaEntNovComStatus = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    if (diaEnt < 0) break;
    const dem = monthKeyFromCell(row[diaEnt], undefined);
    if (!dem || dem.y !== 2026 || dem.m !== 11) continue;
    byDiaEntNov += 1;
    if (isEntregue(row[map.statusEntrega])) byDiaEntNovComStatus += 1;
  }

  console.log("\nRESULTADO (DATA no mês Nov):");
  console.log({
    recolhas_respostas_nov: novSerial,
    entregues_status_entregue: novEntregue,
    status_vazio: novEmptyStatus,
    pct: `${((novEntregue / Math.max(1, novSerial)) * 100).toFixed(1)}%`,
  });
  console.log(
    "Distribuição STATUS DE ENTREGA (Nov por DATA):",
    Object.fromEntries([...statusDist.entries()].sort((a, b) => b[1] - a[1])),
  );
  console.log("Amostras entregues:", samples);
  console.log("\nAlternativa (mês pelo DIA ENTREGA, não pela DATA):", {
    linhas_com_dia_entrega_nov: byDiaEntNov,
    dessas_com_status_entregue: byDiaEntNovComStatus,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
