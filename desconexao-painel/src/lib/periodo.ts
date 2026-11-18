/** Período de visão: TOTAL | YYYY | YYYY-MM */

export const MES_SHORT = [
  "",
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
] as const;

export const MES_NAMES_PT = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Anos sempre oferecidos (atual + próximo); extras vêm dos dados. */
export const ANOS_BASE = ["2026", "2027"] as const;

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function isTotal(periodo: string): boolean {
  return periodo.trim().toUpperCase() === "TOTAL";
}

export function isAnoOnly(periodo: string): boolean {
  return /^\d{4}$/.test(periodo.trim());
}

export function isMesYm(periodo: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodo.trim());
}

export function parsePeriodo(periodo: string): {
  kind: "total" | "ano" | "mes";
  ano: string | null;
  mesNum: number | null;
} {
  const p = periodo.trim();
  if (isTotal(p)) return { kind: "total", ano: null, mesNum: null };
  if (isAnoOnly(p)) return { kind: "ano", ano: p, mesNum: null };
  if (isMesYm(p)) {
    const [y, m] = p.split("-");
    return { kind: "mes", ano: y, mesNum: Number(m) };
  }
  return { kind: "total", ano: null, mesNum: null };
}

export function buildPeriodo(ano: string, mesNum: number | "TOTAL"): string {
  if (ano === "TOTAL" || isTotal(ano)) return "TOTAL";
  if (mesNum === "TOTAL") return ano;
  return `${ano}-${pad2(mesNum)}`;
}

export function anosFromMeses(
  mesesDisponiveis: string[],
  extras: string[] = [...ANOS_BASE],
): string[] {
  const set = new Set<string>(extras);
  for (const ym of mesesDisponiveis) {
    if (isMesYm(ym)) set.add(ym.slice(0, 4));
    else if (isAnoOnly(ym)) set.add(ym);
  }
  return [...set].sort();
}

/** Meses 1–12 disponíveis para o ano (a partir de YYYY-MM). */
export function mesesNoAno(
  mesesDisponiveis: string[],
  ano: string,
): number[] {
  if (ano === "TOTAL" || isTotal(ano)) return [];
  const set = new Set<number>();
  for (const ym of mesesDisponiveis) {
    if (!isMesYm(ym)) continue;
    const [y, m] = ym.split("-");
    if (y === ano) set.add(Number(m));
  }
  return [...set].sort((a, b) => a - b);
}

export function labelPeriodo(periodo: string): string {
  const p = parsePeriodo(periodo);
  if (p.kind === "total") return "TOTAL · todos os períodos";
  if (p.kind === "ano") return `TOTAL · ${p.ano}`;
  return `${MES_NAMES_PT[p.mesNum || 0] || p.mesNum} ${p.ano}`;
}

export function mesBtnShort(mesNum: number): string {
  return MES_SHORT[mesNum] || String(mesNum);
}

/** YYYY-MM bate no período TOTAL | YYYY | YYYY-MM. */
export function ymMatchesPeriodo(ym: string, periodo: string): boolean {
  if (isTotal(periodo)) return true;
  if (isAnoOnly(periodo)) return ym.startsWith(`${periodo}-`);
  return ym === periodo;
}

/** Data dd/mm/aa ou dd/mm/aaaa → YYYY-MM (ou null). */
export function ymFromBrDate(raw: string): string | null {
  const m = String(raw || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const mo = Number(m[2]);
  if (!(mo >= 1 && mo <= 12 && y > 2000)) return null;
  return `${y}-${pad2(mo)}`;
}
