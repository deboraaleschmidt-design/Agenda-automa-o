import {
  countsToList,
  dayFromCell,
  emptyServicoCounts,
  mapRespostasHeader,
  mapTecnicoCodigo,
  monthKeyFromCell,
  normalizeServico,
  parseMesParam,
  type ContagemServico,
} from "./servico";
import {
  MONTH_KEYS,
  TECH_LABELS,
  type GradeColuna,
  type PainelKpis,
  type RankingTecnico,
} from "./types";

const TECH_ORDER = ["Z698465", "Z698466", "SMA", "TCI"] as const;

const MONTH_ABBR_PT: Record<string, number> = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};

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
      escopo: "cabecalho",
    };
  }
  return {
    recolhidos: 0,
    entregues: 0,
    em_processo: 0,
    pct_entregue: 0,
    escopo: "cabecalho",
  };
}

export function parseGradeFromPainel(rows: unknown[][]): {
  colunas: Array<{ nome: string; codigo: string }>;
  dias: number[][];
  totais: number[];
  tituloMes: string;
  notaDuplicados: string;
} {
  const colunas = TECH_ORDER.map((codigo) => ({
    nome: TECH_LABELS[codigo] || codigo,
    codigo,
  }));

  let tituloMes = "";
  let headerIdx = -1;
  let totCol = 31;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("ACOMPANHAMENTO") && t.includes("POR DIA")) {
      tituloMes = cell(rows[i], 0);
      for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
        if (upper(rows[j], 0).includes("TÉCNICO") || upper(rows[j], 0) === "TECNICO") {
          headerIdx = j;
          const hdr = rows[j] || [];
          for (let c = 1; c < hdr.length; c++) {
            if (upper(hdr, c) === "TOT" || upper(hdr, c) === "TOTAL") {
              totCol = c;
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }

  const byCode: Record<string, number[]> = {};
  const totaisByCode: Record<string, number> = {};
  let notaDuplicados = "";
  if (headerIdx >= 0) {
    let i = headerIdx + 1;
    for (; i < rows.length; i++) {
      const code = upper(rows[i], 0);
      const text = rowText(rows[i]);
      if (text.includes("DUPLIC")) {
        notaDuplicados = cell(rows[i], 0);
        break;
      }
      if (!code) break;
      if (code.startsWith("TOTAL")) {
        i += 1;
        break;
      }
      if (code.includes("RECOLHAS") || code.includes("EVOLU")) {
        break;
      }
      if (!(TECH_ORDER as readonly string[]).includes(code)) continue;
      const row = rows[i] || [];
      byCode[code] = row.slice(1, 32).map((v) => num(v));
      totaisByCode[code] =
        totCol < row.length
          ? num(row[totCol])
          : byCode[code].reduce((a, b) => a + b, 0);
    }
    for (; i < Math.min(i + 4, rows.length); i++) {
      const text = rowText(rows[i]);
      if (text.includes("DUPLIC")) {
        notaDuplicados = cell(rows[i], 0);
        break;
      }
      if (text.includes("RECOLHAS POR CIDADE") || text.includes("EVOLU")) break;
    }
  }

  const dias: number[][] = [];
  for (let d = 1; d <= 31; d++) {
    const counts = TECH_ORDER.map((c) => byCode[c]?.[d - 1] ?? 0);
    if (counts.every((n) => n === 0)) continue;
    dias.push([d, ...counts]);
  }

  const totais = TECH_ORDER.map(
    (c) =>
      totaisByCode[c] ??
      (byCode[c] || []).reduce((a, b) => a + b, 0),
  );

  return { colunas, dias, totais, tituloMes, notaDuplicados };
}

export function parsePainelMeta(rows: unknown[][]): {
  atualizado: string;
  titulo: string;
} {
  return {
    titulo: cell(rows[0], 0),
    atualizado: cell(rows[1], 0) || cell(rows[0], 0),
  };
}

/** Bloco TOTAL POR TIPO DE SERVIÇO — desde AGO/2026 (por título). */
export function parseTiposFromPainel(rows: unknown[][]): {
  porMes: Record<string, Array<{ tipo: string; quantidade: number }>>;
  totalDesdeAgo: Array<{ tipo: string; quantidade: number }>;
  totalGeral: Array<{ tipo: string; quantidade: number }>;
  totalDesdeAgoSum: number;
  totalGeralSum: number;
} {
  const empty = {
    porMes: {} as Record<string, Array<{ tipo: string; quantidade: number }>>,
    totalDesdeAgo: [] as Array<{ tipo: string; quantidade: number }>,
    totalGeral: [] as Array<{ tipo: string; quantidade: number }>,
    totalDesdeAgoSum: 0,
    totalGeralSum: 0,
  };

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("TOTAL POR TIPO") || (t.includes("TIPO DE SERVICO") && t.includes("AGO"))) {
      for (let j = i; j < Math.min(i + 5, rows.length); j++) {
        if (upper(rows[j], 0) === "MÊS" || upper(rows[j], 0) === "MES") {
          headerIdx = j;
          break;
        }
      }
      break;
    }
  }
  if (headerIdx < 0) return empty;

  const header = rows[headerIdx] || [];
  const tipoCols: Array<{ tipo: string; col: number }> = [];
  let totalCol = -1;
  for (let c = 1; c < header.length; c++) {
    const h = upper(header, c);
    if (!h) continue;
    if (h === "TOTAL") {
      totalCol = c;
      continue;
    }
    if (h.includes("VERIFICAR") || h.includes("CONTROLE")) {
      tipoCols.push({ tipo: h.includes("CONTROLE") ? "CONTROLE" : "VERIFICAR", col: c });
      continue;
    }
    if (
      h.includes("RETIRADA") ||
      h.includes("DESCONEX") ||
      h.includes("TROCA") ||
      h.includes("INSTALA") ||
      h.includes("REINSTALA")
    ) {
      tipoCols.push({ tipo: cell(header, c).toUpperCase(), col: c });
    }
  }

  const pack = (row: unknown[]) =>
    tipoCols.map(({ tipo, col }) => ({ tipo, quantidade: num(row[col]) }));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const rawLabel = rows[i]?.[0];
    const label = cell(rows[i], 0);
    const u = label.toUpperCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (rawLabel === undefined || rawLabel === null || rawLabel === "") break;
    const row = rows[i] || [];
    const items = pack(row);
    const sum =
      totalCol >= 0
        ? num(row[totalCol])
        : items.reduce((a, b) => a + b.quantidade, 0);

    if (u.startsWith("TOTAL DESDE") || (u.includes("TOTAL") && u.includes("AGO"))) {
      empty.totalDesdeAgo = items;
      empty.totalDesdeAgoSum = sum;
      continue;
    }
    if (u.startsWith("TOTAL GERAL") || (u.includes("TOTAL GERAL") && u.includes("SERIAL"))) {
      empty.totalGeral = items;
      empty.totalGeralSum = sum;
      continue;
    }
    if (u.startsWith("ANTES") || u.startsWith("SEM DATA")) continue;

    const ym = parseTipoMesLabel(
      typeof rawLabel === "number" ? rawLabel : label,
    );
    if (ym) {
      empty.porMes[`${ym.y}-${String(ym.m).padStart(2, "0")}`] = items;
    }
  }

  return empty;
}

function excelSerialToYm(serial: number): { y: number; m: number } | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  // Google Sheets / Excel serial day (epoch 1899-12-30).
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function parseTipoMesLabel(label: string | number): { y: number; m: number } | null {
  if (typeof label === "number") return excelSerialToYm(label);
  const trimmed = String(label || "").trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return excelSerialToYm(Number(trimmed));
  }
  const u = trimmed
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "");
  const ys = u.match(/20\d{2}/);
  const y = ys ? parseInt(ys[0], 10) : 2026;
  for (const [abbr, m] of Object.entries(MONTH_ABBR_PT)) {
    if (u.startsWith(abbr) || u.includes(`${abbr}/`) || u.includes(`${abbr} `)) {
      return { y, m };
    }
  }
  const full = [
    "JANEIRO",
    "FEVEREIRO",
    "MARCO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  for (let i = 0; i < full.length; i++) {
    if (u.includes(full[i])) return { y, m: i + 1 };
  }
  return null;
}

export function resolveTiposForMes(
  painelRows: unknown[][],
  mes: string,
): { itens: Array<{ tipo: string; quantidade: number }>; total: number; fonte: string } {
  const parsed = parseTiposFromPainel(painelRows);
  const nonzero = (items: Array<{ tipo: string; quantidade: number }>) =>
    items.filter((t) => t.quantidade > 0);
  if (mes.trim().toUpperCase() === "TOTAL") {
    const raw =
      parsed.totalDesdeAgo.length > 0
        ? parsed.totalDesdeAgo
        : parsed.totalGeral;
    const itens = nonzero(raw);
    const total =
      parsed.totalDesdeAgoSum ||
      parsed.totalGeralSum ||
      itens.reduce((a, b) => a + b.quantidade, 0);
    return {
      itens,
      total,
      fonte: parsed.totalDesdeAgo.length
        ? "PAINEL · TOTAL desde AGO/2026"
        : "PAINEL · TOTAL GERAL",
    };
  }
  const key = mes.trim();
  const itens = nonzero(parsed.porMes[key] || []);
  const total = itens.reduce((a, b) => a + b.quantidade, 0);
  return {
    itens,
    total,
    fonte: itens.length ? `PAINEL · tipos ${key}` : `PAINEL · sem linha de tipos para ${key}`,
  };
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

  // Sempre JAN–DEZ a partir da grade cidade (evita lixo TOT/LIN/462 do bloco EVOLUÇÃO).
  const evolucao_mensal: Array<{ mes: string; recolhas: number }> =
    MONTH_KEYS.map((k) => ({
      mes: k,
      recolhas: por_cidade_mes.reduce((sum, c) => sum + (c.meses[k] || 0), 0),
    }));

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
 * KPIs for the selected month — só números do PAINEL (sem inventar).
 * TOTAL → cabeçalho (A4/I4/Q4/%).
 * YYYY-MM → recolhas oficiais do mês (cidade/evo); entregues/% ficam 0
 * (células mensais não existem no cabeçalho — UI marca escopo "mes").
 */
export function resolveKpisForMes(
  painelRows: unknown[][],
  _respostas: unknown[][],
  mes: string,
): PainelKpis {
  const header = parseKpisFromPainel(painelRows);
  if (mes.trim().toUpperCase() === "TOTAL") {
    return { ...header, escopo: "cabecalho" };
  }

  const oficiais = recolhidosOficiaisNoMes(painelRows, mes) ?? 0;
  return {
    recolhidos: oficiais,
    entregues: 0,
    em_processo: 0,
    pct_entregue: 0,
    escopo: "mes",
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
    escopo: "mes",
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
    escopo: "mes",
  };
}

export function buildRankingFromGrade(
  colunas: GradeColuna[],
  totais: number[],
): RankingTecnico[] {
  return colunas
    .map((c, i) => ({
      nome: c.nome,
      codigo: c.codigo,
      volume: totais[i] || 0,
    }))
    .sort((a, b) => b.volume - a.volume);
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

function sheetGradeMonthKey(tituloMes: string): string | null {
  const u = tituloMes
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const full = [
    "JANEIRO",
    "FEVEREIRO",
    "MARCO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  for (let i = 0; i < MONTH_KEYS.length; i++) {
    if (u.includes(MONTH_KEYS[i]) || u.includes(full[i])) {
      const ys = u.match(/20\d{2}/);
      const y = ys ? parseInt(ys[0], 10) : 2026;
      return `${y}-${String(i + 1).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Grade dia×técnico do mês: PAINEL se o título bate; senão Respostas. TOTAL = vazia. */
export function resolveGradeForMes(
  painelRows: unknown[][],
  respostas: unknown[][],
  mes: string,
): {
  colunas: GradeColuna[];
  dias: number[][];
  totais: number[];
  tituloMes: string;
  fonteGrade: "painel" | "respostas" | "none";
  notaDuplicados: string;
} {
  const colunas = TECH_ORDER.map((codigo) => ({
    nome: TECH_LABELS[codigo] || codigo,
    codigo,
  }));
  if (mes.trim().toUpperCase() === "TOTAL") {
    const fromPainel = parseGradeFromPainel(painelRows);
    return {
      colunas,
      dias: [],
      totais: fromPainel.totais,
      tituloMes: "TOTAL — período completo · escolha um mês p/ grade dia×técnico",
      fonteGrade: "none",
      notaDuplicados: fromPainel.notaDuplicados,
    };
  }

  const fromPainel = parseGradeFromPainel(painelRows);
  const sheetMes = sheetGradeMonthKey(fromPainel.tituloMes);
  if (sheetMes && sheetMes === mes.trim() && fromPainel.dias.length > 0) {
    return { ...fromPainel, fonteGrade: "painel" };
  }

  const fromResp = buildGradeFromRespostas(respostas, mes);
  const totais = TECH_ORDER.map((c, i) =>
    fromResp.reduce((s, row) => s + (row[i + 1] || 0), 0),
  );
  return {
    colunas,
    dias: fromResp,
    totais,
    tituloMes: fromResp.length
      ? `Respostas · ${mes}`
      : `Sem grade dia×técnico no PAINEL para ${mes}`,
    fonteGrade: fromResp.length ? "respostas" : "none",
    notaDuplicados: fromPainel.notaDuplicados,
  };
}

export function buildGradeFromRespostas(
  respostas: unknown[][],
  mes: string,
): number[][] {
  const headerIdx = findRespostasHeaderIndex(respostas);
  if (headerIdx < 0 || !isMesOrTotal(mes) || mes.trim().toUpperCase() === "TOTAL") {
    return [];
  }
  const map = mapRespostasHeader(respostas[headerIdx] || []);
  const byDay: Record<number, Record<string, number>> = {};

  for (let i = headerIdx + 1; i < respostas.length; i++) {
    const row = respostas[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    const mk = rowMonthKey(map, row);
    if (!rowMatchesMes(mk, mes)) continue;
    const code = mapTecnicoCodigo(
      map.tecnico >= 0 ? row[map.tecnico] : undefined,
    );
    if (!code) continue;
    const dataVal = map.data >= 0 ? row[map.data] : undefined;
    const tsVal = map.ts >= 0 ? row[map.ts] : undefined;
    const day = dayFromCell(dataVal) ?? dayFromCell(tsVal);
    if (!day || day < 1 || day > 31) continue;
    byDay[day] ??= {};
    byDay[day][code] = (byDay[day][code] || 0) + 1;
  }

  return Object.keys(byDay)
    .map((d) => Number(d))
    .sort((a, b) => a - b)
    .map((day) => [
      day,
      ...TECH_ORDER.map((c) => byDay[day][c] || 0),
    ]);
}
