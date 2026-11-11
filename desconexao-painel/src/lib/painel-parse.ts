import {
  countsToList,
  emptyServicoCounts,
  mapRespostasHeader,
  monthKeyFromCell,
  normalizeServico,
  parseMesParam,
  type ContagemServico,
} from "./servico";
import { MONTH_KEYS, TECH_LABELS, type PainelKpis } from "./types";

const TECH_ORDER = ["Z698465", "Z698466", "SMA", "TCI"] as const;

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "").trim();
}

function upper(row: unknown[] | undefined, i: number): string {
  return cell(row, i).toUpperCase();
}

export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function rowText(row: unknown[] | undefined): string {
  return (row || []).map((c) => String(c || "")).join(" ").toUpperCase();
}

/** KPIs by label columns (layout spaces values across A/I/Q/Y, not A–D). */
export function parseKpisFromPainel(rows: unknown[][]): PainelKpis {
  for (let i = 0; i < rows.length - 1; i++) {
    const labelRow = rows[i] || [];
    let colRec = -1;
    let colEnt = -1;
    let colProc = -1;
    let colPct = -1;
    for (let c = 0; c < labelRow.length; c++) {
      const h = upper(labelRow, c);
      if (!h) continue;
      if (colRec < 0 && h.includes("RECOLHID")) colRec = c;
      else if (colEnt < 0 && h.includes("ENTREGUES")) colEnt = c;
      else if (colProc < 0 && h.includes("PROCESSO")) colProc = c;
      else if (colPct < 0 && h.includes("%") && h.includes("ENTREG")) colPct = c;
    }
    if (colRec < 0 || colEnt < 0) continue;
    const values = rows[i + 1] || [];
    let pct = num(values[colPct]);
    if (pct > 1) pct = pct / 100;
    return {
      recolhidos: num(values[colRec]),
      entregues: num(values[colEnt]),
      em_processo: colProc >= 0 ? num(values[colProc]) : 0,
      pct_entregue: colPct >= 0 ? pct : 0,
    };
  }
  return { recolhidos: 0, entregues: 0, em_processo: 0, pct_entregue: 0 };
}

export function parseGradeFromPainel(rows: unknown[][]): {
  colunas: Array<{ nome: string; codigo: string }>;
  dias: number[][];
  tituloMes: string;
} {
  const colunas = TECH_ORDER.map((codigo) => ({
    nome: TECH_LABELS[codigo] || codigo,
    codigo,
  }));

  let tituloMes = "";
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("ACOMPANHAMENTO") && t.includes("POR DIA")) {
      tituloMes = cell(rows[i], 0);
      for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
        if (upper(rows[j], 0).includes("TÉCNICO") || upper(rows[j], 0) === "TECNICO") {
          headerIdx = j;
          break;
        }
      }
      break;
    }
  }

  const byCode: Record<string, number[]> = {};
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const code = upper(rows[i], 0);
      if (!code) break;
      if (code.startsWith("TOTAL")) break;
      if (code.includes("SERIAL") || code.includes("RECOLHAS") || code.includes("EVOLU")) {
        break;
      }
      if (!(TECH_ORDER as readonly string[]).includes(code)) continue;
      byCode[code] = (rows[i] || []).slice(1, 32).map((v) => num(v));
    }
  }

  const dias: number[][] = [];
  for (let d = 1; d <= 31; d++) {
    const counts = TECH_ORDER.map((c) => byCode[c]?.[d - 1] ?? 0);
    if (counts.every((n) => n === 0)) continue;
    dias.push([d, ...counts]);
  }

  return { colunas, dias, tituloMes };
}

export function parseCidadesFromPainel(rows: unknown[][]): {
  por_cidade_mes: Array<{
    cidade: string;
    meses: Record<string, number>;
    total: number;
  }>;
  evolucao_mensal: Array<{ mes: string; recolhas: number }>;
} {
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("RECOLHAS POR CIDADE") || (t.includes("CIDADE") && t.includes("JAN"))) {
      if (t.includes("RECOLHAS POR CIDADE")) {
        start = i + 1;
      } else if (upper(rows[i], 0) === "CIDADE") {
        start = i;
      }
      if (start >= 0) break;
    }
  }

  const por_cidade_mes: Array<{
    cidade: string;
    meses: Record<string, number>;
    total: number;
  }> = [];

  if (start >= 0) {
    const header = upper(rows[start], 0);
    const dataStart = header === "CIDADE" || header.includes("CIDADE") ? start + 1 : start;
    for (let i = dataStart; i < rows.length; i++) {
      const cidade = cell(rows[i], 0);
      const u = cidade.toUpperCase();
      if (!cidade) break;
      if (u.includes("EVOLU")) break;
      if (u === "TOTAL") continue;
      if (u === "MÊS" || u === "MES") break;
      const meses: Record<string, number> = {};
      MONTH_KEYS.forEach((k, idx) => {
        meses[k] = num((rows[i] || [])[idx + 1]);
      });
      const total =
        num((rows[i] || [])[13]) ||
        Object.values(meses).reduce((a, b) => a + b, 0);
      por_cidade_mes.push({ cidade, meses, total });
    }
  }

  const evolucao_mensal: Array<{ mes: string; recolhas: number }> = [];
  let inEvo = false;
  for (const row of rows) {
    const a = upper(row, 0);
    if (a.includes("EVOLU")) {
      inEvo = true;
      continue;
    }
    if (!inEvo) continue;
    if (a === "MÊS" || a === "MES") continue;
    if (!a) continue;
    evolucao_mensal.push({ mes: a.slice(0, 3), recolhas: num(row?.[1]) });
  }
  if (evolucao_mensal.length === 0) {
    for (let i = 0; i < 12; i++) {
      const k = MONTH_KEYS[i];
      const recolhas = por_cidade_mes.reduce(
        (sum, c) => sum + (c.meses[k] || 0),
        0,
      );
      evolucao_mensal.push({ mes: k, recolhas });
    }
  }

  return { por_cidade_mes, evolucao_mensal };
}

/** Skip blank leading rows — Respostas often has an empty row 1. */
export function findRespostasHeaderIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const map = mapRespostasHeader(rows[i] || []);
    if (map.serial >= 0 && map.servico >= 0) return i;
  }
  return -1;
}

const TIPOS_DESDE = { y: 2026, m: 8 } as const;

function rowMonthKey(
  map: ReturnType<typeof mapRespostasHeader>,
  row: unknown[],
): { y: number; m: number } | null {
  const dataVal = map.data >= 0 ? row[map.data] : undefined;
  const tsVal = map.ts >= 0 ? row[map.ts] : undefined;
  const periodVal = map.period >= 0 ? row[map.period] : undefined;
  return (
    monthKeyFromCell(dataVal, periodVal) ||
    monthKeyFromCell(tsVal, periodVal)
  );
}

/** Include row for YYYY-MM or TOTAL (tipos/KPIs desde ago/2026). */
export function rowMatchesMes(
  mk: { y: number; m: number } | null,
  mes: string,
): boolean {
  if (!mk) return false;
  const isTotal = mes.trim().toUpperCase() === "TOTAL";
  if (isTotal) {
    return !(
      mk.y < TIPOS_DESDE.y ||
      (mk.y === TIPOS_DESDE.y && mk.m < TIPOS_DESDE.m)
    );
  }
  const target = parseMesParam(mes);
  return !!target && mk.y === target.y && mk.m === target.m;
}

function isEntregueStatus(raw: unknown): boolean {
  const u = String(raw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return u.includes("ENTREGUE");
}

/** Official monthly recolhas from PAINEL city×mês / evolução (not the header block). */
export function recolhidosOficiaisNoMes(
  painelRows: unknown[][],
  mes: string,
): number | null {
  const cidades = parseCidadesFromPainel(painelRows);
  if (mes.trim().toUpperCase() === "TOTAL") {
    const fromEvo = cidades.evolucao_mensal.reduce(
      (s, e) => s + (e.recolhas || 0),
      0,
    );
    if (fromEvo > 0) return fromEvo;
    const fromCities = cidades.por_cidade_mes.reduce(
      (s, c) => s + (c.total || 0),
      0,
    );
    return fromCities > 0 ? fromCities : null;
  }
  const target = parseMesParam(mes);
  if (!target) return null;
  const key = MONTH_KEYS[target.m - 1];
  const evo = cidades.evolucao_mensal.find((e) => e.mes === key)?.recolhas;
  if (typeof evo === "number" && evo > 0) return evo;
  const sum = cidades.por_cidade_mes.reduce(
    (s, c) => s + (c.meses[key] || 0),
    0,
  );
  return sum > 0 ? sum : 0;
}

/**
 * KPIs for the selected month.
 * TOTAL → cabeçalho PAINEL (totais oficiais da planilha).
 * YYYY-MM → recolhidos oficiais do mês na grade cidade/evo; entregues/%
 * a partir de Respostas no mesmo mês (mesma regra dos tipos de serviço).
 */
export function resolveKpisForMes(
  painelRows: unknown[][],
  respostas: unknown[][],
  mes: string,
): PainelKpis {
  const header = parseKpisFromPainel(painelRows);
  if (mes.trim().toUpperCase() === "TOTAL") return header;

  const fromResp = aggregateKpisFromRespostas(respostas, mes);
  const oficiais = recolhidosOficiaisNoMes(painelRows, mes);
  if (oficiais == null) return fromResp;

  if (fromResp.recolhidos <= 0) {
    return {
      recolhidos: oficiais,
      entregues: 0,
      em_processo: oficiais,
      pct_entregue: 0,
    };
  }
  const ratio = fromResp.entregues / fromResp.recolhidos;
  const entregues = Math.min(
    oficiais,
    Math.round(oficiais * ratio),
  );
  const em_processo = Math.max(0, oficiais - entregues);
  return {
    recolhidos: oficiais,
    entregues,
    em_processo,
    pct_entregue: oficiais > 0 ? entregues / oficiais : 0,
  };
}

export function aggregateKpisFromRespostas(
  respostas: unknown[][],
  mes: string,
): PainelKpis {
  const empty: PainelKpis = {
    recolhidos: 0,
    entregues: 0,
    em_processo: 0,
    pct_entregue: 0,
  };
  const headerIdx = findRespostasHeaderIndex(respostas);
  if (headerIdx < 0) return empty;
  if (!isMesOrTotal(mes)) return empty;

  const map = mapRespostasHeader(respostas[headerIdx] || []);
  let recolhidos = 0;
  let entregues = 0;
  for (let i = headerIdx + 1; i < respostas.length; i++) {
    const row = respostas[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    const mk = rowMonthKey(map, row);
    if (!rowMatchesMes(mk, mes)) continue;
    recolhidos += 1;
    const status =
      map.statusEntrega >= 0 ? row[map.statusEntrega] : undefined;
    if (isEntregueStatus(status)) entregues += 1;
  }
  const em_processo = Math.max(0, recolhidos - entregues);
  return {
    recolhidos,
    entregues,
    em_processo,
    pct_entregue: recolhidos > 0 ? entregues / recolhidos : 0,
  };
}

export function aggregateServicos(
  respostas: unknown[][],
  mes: string,
): ContagemServico[] {
  const counts: Record<string, number> = { ...emptyServicoCounts(), OUTROS: 0 };
  const headerIdx = findRespostasHeaderIndex(respostas);
  if (headerIdx < 0) return countsToList(counts);
  if (!isMesOrTotal(mes)) return countsToList(counts);

  const map = mapRespostasHeader(respostas[headerIdx] || []);
  const servicoCol = map.servico >= 0 ? map.servico : 11;

  for (let i = headerIdx + 1; i < respostas.length; i++) {
    const row = respostas[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    const mk = rowMonthKey(map, row);
    if (!rowMatchesMes(mk, mes)) continue;
    const tipo = normalizeServico(row[servicoCol]);
    counts[tipo] = (counts[tipo] || 0) + 1;
  }
  return countsToList(counts);
}

export function isMesOrTotal(mes: string): boolean {
  const t = mes.trim();
  if (t.toUpperCase() === "TOTAL") return true;
  return !!parseMesParam(t);
}
