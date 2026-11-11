import { num } from "./painel-parse";

export type APagarLinha = {
  tecnico: string;
  volume: number;
  unitario: number;
  valor: number;
  status: string;
};

export type FaturamentoMes = {
  mes: string;
  recolhas: number;
  faturamento: number;
  unitario_medio: number;
  periodo: string;
};

export type FinancePayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  quinzena_titulo: string;
  a_pagar: APagarLinha[];
  total_a_pagar: number;
  faturamento_meses: FaturamentoMes[];
  faturamento_ago_mais: { recolhas: number; valor: number };
};

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "").trim();
}

function money(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v || "")
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** PAINEL RECOLHAS — bloco A PAGAR da quinzena. */
export function parseAPagar(rows: unknown[][]): {
  titulo: string;
  linhas: APagarLinha[];
  total: number;
} {
  const titulo = cell(rows[0], 0) || "A pagar";
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0).toUpperCase();
    if (a === "TÉCNICO" || a === "TECNICO") {
      header = i;
      break;
    }
  }
  const linhas: APagarLinha[] = [];
  let total = 0;
  if (header < 0) return { titulo, linhas, total };
  for (let i = header + 1; i < rows.length; i++) {
    const nome = cell(rows[i], 0);
    if (!nome) break;
    const u = nome.toUpperCase();
    if (u.includes("SERIAL") || u.includes("CONFER")) break;
    if (u.startsWith("TOTAL")) {
      total = money(rows[i]?.[3]);
      break;
    }
    linhas.push({
      tecnico: nome,
      volume: num(rows[i]?.[1]),
      unitario: money(rows[i]?.[2]),
      valor: money(rows[i]?.[3]),
      status: cell(rows[i], 4) || "A PAGAR",
    });
  }
  if (!total) total = linhas.reduce((s, l) => s + l.valor, 0);
  return { titulo, linhas, total };
}

/** FATURAR CLARO — tabela mensal cronológica. */
export function parseFaturamento(rows: unknown[][]): {
  meses: FaturamentoMes[];
  agoMais: { recolhas: number; valor: number };
} {
  const meses: FaturamentoMes[] = [];
  let agoMais = { recolhas: 0, valor: 0 };
  let inTable = false;
  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0);
    const u = a.toUpperCase();
    if (u.includes("RECOLHAS AGO")) {
      agoMais = {
        recolhas: num(rows[i]?.[1]),
        valor: money(rows[i]?.[3]),
      };
      continue;
    }
    if (u.startsWith("MÊS") || u.startsWith("MES")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!a) continue;
    if (u.startsWith("TOTAL")) continue;
    if (u.includes("SERIAL") || u.includes("A PARTIR")) break;
    meses.push({
      mes: a,
      recolhas: num(rows[i]?.[1]),
      faturamento: money(rows[i]?.[2]),
      unitario_medio: money(rows[i]?.[3]),
      periodo: cell(rows[i], 4),
    });
  }
  return { meses, agoMais };
}
