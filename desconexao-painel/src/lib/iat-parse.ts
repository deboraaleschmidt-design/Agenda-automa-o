import { num } from "./painel-parse";

export type IatBase = "CANOAS" | "PORTO ALEGRE" | "TOTAL";

export type IatTechRow = {
  tecnico: string;
  dias: number[];
  total: number;
};

export type IatBlock = {
  base: "CANOAS" | "PORTO ALEGRE";
  kind: "produtivas" | "improdutivas";
  diasHeader: number[];
  tecnicos: IatTechRow[];
};

export type IatPayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  titulo: string;
  blocos: IatBlock[];
  resumo: Array<{
    base: string;
    produtivas: number;
    improdutivas: number;
    pct_produtivas: number;
  }>;
};

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "").trim();
}

function upper(row: unknown[] | undefined, i: number): string {
  return cell(row, i).toUpperCase();
}

function rowText(row: unknown[] | undefined): string {
  return (row || []).map((c) => String(c || "")).join(" ").toUpperCase();
}

function parseTechBlock(
  rows: unknown[][],
  start: number,
  base: "CANOAS" | "PORTO ALEGRE",
  kind: "produtivas" | "improdutivas",
): { block: IatBlock; next: number } {
  let i = start;
  let diasHeader: number[] = [];
  // skip weekday row if present
  while (i < rows.length && !upper(rows[i], 0).startsWith("TÉCNICO") && upper(rows[i], 0) !== "TECNICO") {
    i += 1;
    if (i - start > 4) break;
  }
  if (i < rows.length && (upper(rows[i], 0).startsWith("TÉCNICO") || upper(rows[i], 0) === "TECNICO")) {
    diasHeader = (rows[i] || [])
      .slice(1)
      .map((v) => num(v))
      .filter((n) => n >= 1 && n <= 31);
    i += 1;
  }
  const tecnicos: IatTechRow[] = [];
  for (; i < rows.length; i++) {
    const nome = cell(rows[i], 0);
    if (!nome) break;
    const u = nome.toUpperCase();
    if (u.startsWith("TOTAL")) break;
    if (u.includes("PRODUTIV") || u.includes("IMPRODUT") || u.includes("RESUMO")) {
      break;
    }
    const dias = (rows[i] || []).slice(1, 1 + Math.max(diasHeader.length, 31)).map((v) => num(v));
    const total = dias.reduce((a, b) => a + b, 0);
    tecnicos.push({ tecnico: nome, dias, total });
  }
  return {
    block: { base, kind, diasHeader, tecnicos },
    next: i,
  };
}

/** Parse aba IAT by section titles (Canoas/POA × produtivas/improdutivas). */
export function parseIatSheet(rows: unknown[][]): Omit<
  IatPayload,
  "atualizado_em" | "fonte" | "status"
> {
  const titulo = cell(rows[0], 0) || "IAT";
  const blocos: IatBlock[] = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (!t) continue;
    const isProd = t.includes("PRODUTIV") && !t.includes("IMPRODUT");
    const isImpr = t.includes("IMPRODUT");
    if (!isProd && !isImpr) continue;
    if (t.includes("TOTAL IAT")) continue;
    let base: "CANOAS" | "PORTO ALEGRE" | null = null;
    if (t.includes("CANOAS")) base = "CANOAS";
    else if (t.includes("PORTO ALEGRE") || t.includes("POA")) base = "PORTO ALEGRE";
    if (!base) continue;
    const kind = isImpr ? "improdutivas" : "produtivas";
    const { block, next } = parseTechBlock(rows, i + 1, base, kind);
    blocos.push(block);
    i = Math.max(i, next - 1);
  }

  const resumoMap: Record<string, { produtivas: number; improdutivas: number }> = {
    CANOAS: { produtivas: 0, improdutivas: 0 },
    "PORTO ALEGRE": { produtivas: 0, improdutivas: 0 },
  };
  for (const b of blocos) {
    const sum = b.tecnicos.reduce((s, t) => s + t.total, 0);
    if (b.kind === "produtivas") resumoMap[b.base].produtivas = sum;
    else resumoMap[b.base].improdutivas = sum;
  }

  // Prefer RESUMO block if present
  for (let i = 0; i < rows.length; i++) {
    if (!rowText(rows[i]).includes("RESUMO")) continue;
    for (let j = i + 1; j < Math.min(i + 8, rows.length); j++) {
      const base = cell(rows[j], 0).toUpperCase();
      if (base === "CANOAS") {
        resumoMap.CANOAS = {
          produtivas: num(rows[j]?.[1]),
          improdutivas: num(rows[j]?.[7] ?? rows[j]?.[2]),
        };
      }
      if (base.includes("PORTO")) {
        resumoMap["PORTO ALEGRE"] = {
          produtivas: num(rows[j]?.[1]),
          improdutivas: num(rows[j]?.[7] ?? rows[j]?.[2]),
        };
      }
    }
  }

  const resumo = Object.entries(resumoMap).map(([base, v]) => {
    const tot = v.produtivas + v.improdutivas;
    return {
      base,
      produtivas: v.produtivas,
      improdutivas: v.improdutivas,
      pct_produtivas: tot > 0 ? v.produtivas / tot : 0,
    };
  });
  const totP = resumo.reduce((s, r) => s + r.produtivas, 0);
  const totI = resumo.reduce((s, r) => s + r.improdutivas, 0);
  const tot = totP + totI;
  resumo.push({
    base: "TOTAL",
    produtivas: totP,
    improdutivas: totI,
    pct_produtivas: tot > 0 ? totP / tot : 0,
  });

  return { titulo, blocos, resumo, mensagem: undefined };
}

export function filterIatBlocks(
  blocos: IatBlock[],
  base: IatBase,
): IatBlock[] {
  if (base === "TOTAL") return blocos;
  return blocos.filter((b) => b.base === base);
}
