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

export type EquipeRow = {
  login: string;
  tipo: string;
  nome: string;
  base: string;
  setor: string;
  situacao: string;
};

export type PainelOkResumo = {
  contratos_ok: { canoas: number; poa: number; total: number };
  improdutivas: { canoas: number; poa: number; total: number };
  pct_painel: { canoas: number; poa: number; total: number };
  adesao_ok: number;
  migracao_ok: number;
  ofensor: string;
  periodo_nota: string;
};

export type PainelOkTech = {
  base: string;
  pos: string;
  tecnico: string;
  login: string;
  vinculo: string;
  contratos_ok: number;
  improdutivas: number;
  pct_painel: number;
  adesao: number;
  migracao: number;
};

export type RetornoResumo = {
  retornos_concluidos: { canoas: number; poa: number; total: number };
  retornos_gerados: { canoas: number; poa: number; total: number };
  pai_diferente: { canoas: number; poa: number; total: number };
  pai_igual: { canoas: number; poa: number; total: number };
  pai_nao_id: { canoas: number; poa: number; total: number };
  maior_motivo: string;
  periodo_nota: string;
};

export type RetornoOfensor = {
  pos: string;
  tecnico: string;
  base: string;
  login: string;
  retornos: number;
  maior_motivo: string;
  qtd_motivo: number;
  atendidos_outro: number;
  sobre_409: number;
};

export type RetornoMotivo = {
  codigo: string;
  descricao: string;
  canoas: number;
  poa: number;
  total: number;
};

export type IatPayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  titulo: string;
  mes: string;
  mes_aba: string | null;
  blocos: IatBlock[];
  resumo: Array<{
    base: string;
    produtivas: number;
    improdutivas: number;
    total_contratos: number;
    pct_produtivas: number;
  }>;
  ranking: Array<{ tecnico: string; base: string; produtivas: number; improdutivas: number }>;
  painel_ok: {
    resumo: PainelOkResumo | null;
    tecnicos: PainelOkTech[];
  };
  retorno: {
    resumo: RetornoResumo | null;
    ofensores: RetornoOfensor[];
    motivos: RetornoMotivo[];
  };
  equipe: EquipeRow[];
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

function pctFromCell(v: unknown): number {
  const n = num(v);
  return n > 1 ? n / 100 : n;
}

function parseTechBlock(
  rows: unknown[][],
  start: number,
  base: "CANOAS" | "PORTO ALEGRE",
  kind: "produtivas" | "improdutivas",
): { block: IatBlock; next: number } {
  let i = start;
  let diasHeader: number[] = [];
  while (
    i < rows.length &&
    !upper(rows[i], 0).startsWith("TÉCNICO") &&
    upper(rows[i], 0) !== "TECNICO"
  ) {
    i += 1;
    if (i - start > 4) break;
  }
  if (
    i < rows.length &&
    (upper(rows[i], 0).startsWith("TÉCNICO") || upper(rows[i], 0) === "TECNICO")
  ) {
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
    const row = rows[i] || [];
    const dias = row.slice(1, 1 + Math.max(diasHeader.length, 31)).map((v) => num(v));
    let total = 0;
    // Prefer explicit TOTAL column after days (often col 32 with blank before)
    for (let c = row.length - 1; c >= 1; c--) {
      const h = String(row[c] ?? "").trim();
      if (h !== "") {
        total = num(row[c]);
        break;
      }
    }
    if (!total) total = dias.reduce((a, b) => a + b, 0);
    tecnicos.push({ tecnico: nome, dias, total });
  }
  return {
    block: { base, kind, diasHeader, tecnicos },
    next: i,
  };
}

export function detectIatMesFromTitle(titulo: string): string | null {
  const u = titulo
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const months = [
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
  const ys = u.match(/20\d{2}/);
  const y = ys ? parseInt(ys[0], 10) : 2026;
  for (let i = 0; i < months.length; i++) {
    if (u.includes(months[i])) {
      return `${y}-${String(i + 1).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Parse aba IAT by section titles (Canoas/POA × produtivas/improdutivas). */
export function parseIatSheet(rows: unknown[][]): {
  titulo: string;
  mes_aba: string | null;
  blocos: IatBlock[];
  resumo: IatPayload["resumo"];
  ranking: IatPayload["ranking"];
} {
  const titulo = cell(rows[0], 0) || "IAT";
  const mes_aba = detectIatMesFromTitle(titulo);
  const blocos: IatBlock[] = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (!t) continue;
    // Skip page title "PRODUTIVAS E IMPRODUTIVAS…" and totals.
    if (t.includes("PRODUTIVAS E IMPRODUTIVAS")) continue;
    if (t.includes("TOTAL IAT")) continue;
    let kind: "produtivas" | "improdutivas" | null = null;
    if (t.includes("IMPRODUTIVAS")) kind = "improdutivas";
    else if (t.includes("PRODUTIVAS") || t.includes("CONTRATOS OK")) kind = "produtivas";
    if (!kind) continue;
    let base: "CANOAS" | "PORTO ALEGRE" | null = null;
    if (t.includes("CANOAS")) base = "CANOAS";
    else if (t.includes("PORTO ALEGRE") || t.includes("PORTO")) base = "PORTO ALEGRE";
    if (!base) continue;
    const { block, next } = parseTechBlock(rows, i + 1, base, kind);
    if (block.tecnicos.length === 0) continue;
    blocos.push(block);
    i = Math.max(i, next - 1);
  }

  const resumoMap: Record<
    string,
    { produtivas: number; improdutivas: number; total: number; pct: number }
  > = {
    CANOAS: { produtivas: 0, improdutivas: 0, total: 0, pct: 0 },
    "PORTO ALEGRE": { produtivas: 0, improdutivas: 0, total: 0, pct: 0 },
    "TOTAL IAT": { produtivas: 0, improdutivas: 0, total: 0, pct: 0 },
  };

  for (const b of blocos) {
    const sum = b.tecnicos.reduce((s, t) => s + t.total, 0);
    if (b.kind === "produtivas") resumoMap[b.base].produtivas = sum;
    else resumoMap[b.base].improdutivas = sum;
  }

  for (let i = 0; i < rows.length; i++) {
    if (!rowText(rows[i]).includes("RESUMO POR CONTRATO")) continue;
    for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
      const base = cell(rows[j], 0).toUpperCase();
      if (!base) continue;
      const row = rows[j] || [];
      const prod = num(row[1]);
      // sparse layout: improdutivas often at col 7
      let impr = num(row[7]);
      if (!impr) impr = num(row[2]);
      let tot = num(row[13]);
      if (!tot) tot = prod + impr;
      let pct = pctFromCell(row[19] ?? row[14] ?? row[8]);
      if (!pct && tot > 0) pct = prod / tot;
      if (base === "CANOAS") {
        resumoMap.CANOAS = { produtivas: prod, improdutivas: impr, total: tot, pct };
      } else if (base.includes("PORTO")) {
        resumoMap["PORTO ALEGRE"] = {
          produtivas: prod,
          improdutivas: impr,
          total: tot,
          pct,
        };
      } else if (base.includes("TOTAL")) {
        resumoMap["TOTAL IAT"] = {
          produtivas: prod,
          improdutivas: impr,
          total: tot,
          pct,
        };
      }
    }
  }

  const resumo: IatPayload["resumo"] = ["CANOAS", "PORTO ALEGRE"].map((base) => {
    const v = resumoMap[base];
    const tot = v.total || v.produtivas + v.improdutivas;
    return {
      base,
      produtivas: v.produtivas,
      improdutivas: v.improdutivas,
      total_contratos: tot,
      pct_produtivas: v.pct || (tot > 0 ? v.produtivas / tot : 0),
    };
  });
  const totRow = resumoMap["TOTAL IAT"];
  const totP = totRow.produtivas || resumo.reduce((s, r) => s + r.produtivas, 0);
  const totI = totRow.improdutivas || resumo.reduce((s, r) => s + r.improdutivas, 0);
  const totC = totRow.total || totP + totI;
  resumo.push({
    base: "TOTAL",
    produtivas: totP,
    improdutivas: totI,
    total_contratos: totC,
    pct_produtivas: totRow.pct || (totC > 0 ? totP / totC : 0),
  });

  const byTech: Record<
    string,
    { tecnico: string; base: string; produtivas: number; improdutivas: number }
  > = {};
  for (const b of blocos) {
    for (const t of b.tecnicos) {
      const key = `${b.base}::${t.tecnico}`;
      byTech[key] ??= {
        tecnico: t.tecnico,
        base: b.base,
        produtivas: 0,
        improdutivas: 0,
      };
      if (b.kind === "produtivas") byTech[key].produtivas = t.total;
      else byTech[key].improdutivas = t.total;
    }
  }
  const ranking = Object.values(byTech).sort(
    (a, b) => b.produtivas - a.produtivas || a.tecnico.localeCompare(b.tecnico),
  );

  return { titulo, mes_aba, blocos, resumo, ranking };
}

export function parseEquipe(rows: unknown[][]): EquipeRow[] {
  const out: EquipeRow[] = [];
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (upper(rows[i], 0) === "LOGIN" && upper(rows[i], 2).includes("NOME")) {
      header = i;
      break;
    }
  }
  if (header < 0) return out;
  for (let i = header + 1; i < rows.length; i++) {
    const login = cell(rows[i], 0);
    if (!login) break;
    if (login.toUpperCase().includes("CLASSIFICAR")) break;
    if (login.toUpperCase() === "LOGIN") break;
    out.push({
      login,
      tipo: cell(rows[i], 1),
      nome: cell(rows[i], 2),
      base: cell(rows[i], 3),
      setor: cell(rows[i], 4),
      situacao: cell(rows[i], 5),
    });
  }
  return out;
}

export function parsePainelOk(rows: unknown[][]): {
  resumo: PainelOkResumo | null;
  tecnicos: PainelOkTech[];
} {
  const periodo_nota = cell(rows[1], 0) || cell(rows[0], 0);
  let contratos_ok = { canoas: 0, poa: 0, total: 0 };
  let improdutivas = { canoas: 0, poa: 0, total: 0 };
  let pct_painel = { canoas: 0, poa: 0, total: 0 };
  let adesao_ok = 0;
  let migracao_ok = 0;
  let ofensor = "";

  for (let i = 0; i < rows.length; i++) {
    const label = cell(rows[i], 1) || cell(rows[i], 0);
    const u = label.toUpperCase();
    const row = rows[i] || [];
    // Layout: col B indicator, C Canoas, D POA, E TOTAL
    const c = num(row[2]);
    const d = num(row[3]);
    const e = num(row[4]);
    if (u.startsWith("CONTRATOS OK (PRODUTIVAS)")) {
      contratos_ok = { canoas: c, poa: d, total: e };
    } else if (u.startsWith("IMPRODUTIVAS (CONTRATOS)")) {
      improdutivas = { canoas: c, poa: d, total: e };
    } else if (u.includes("% PAINEL")) {
      pct_painel = {
        canoas: pctFromCell(row[2]),
        poa: pctFromCell(row[3]),
        total: pctFromCell(row[4]),
      };
    } else if (u.startsWith("TAREFAS DE ADESÃO") && u.includes("OK")) {
      adesao_ok = e || c + d;
    } else if (u.startsWith("TAREFAS DE MIGRAÇÃO") && u.includes("OK")) {
      migracao_ok = e || c + d;
    } else if (u.startsWith("OFENSOR GERAL")) {
      ofensor = cell(row, 4) || cell(row, 2);
    }
  }

  const tecnicos: PainelOkTech[] = [];
  let currentBase = "";
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("RESUMO POR TÉCNICO")) continue;
    if (upper(rows[i], 1) === "CANOAS" || (cell(rows[i], 1) === "" && upper(rows[i], 0) === "")) {
      /* skip */
    }
    if (cell(rows[i], 1).toUpperCase() === "CANOAS" || cell(rows[i], 0).toUpperCase() === "CANOAS") {
      currentBase = "CANOAS";
      continue;
    }
    if (
      cell(rows[i], 1).toUpperCase().includes("PORTO") ||
      cell(rows[i], 0).toUpperCase().includes("PORTO")
    ) {
      currentBase = "PORTO ALEGRE";
      continue;
    }
    const pos = cell(rows[i], 0);
    if (!/^\d/.test(pos) && !pos.includes("º")) continue;
    if (!currentBase) continue;
    const row = rows[i] || [];
    tecnicos.push({
      base: currentBase,
      pos,
      tecnico: cell(row, 1),
      login: cell(row, 2),
      vinculo: cell(row, 3),
      contratos_ok: num(row[4]),
      improdutivas: num(row[5]),
      pct_painel: pctFromCell(row[6]),
      adesao: num(row[7]),
      migracao: num(row[8]),
    });
  }

  const resumo: PainelOkResumo | null = contratos_ok.total
    ? {
        contratos_ok,
        improdutivas,
        pct_painel,
        adesao_ok,
        migracao_ok,
        ofensor,
        periodo_nota,
      }
    : null;

  return { resumo, tecnicos };
}

export function parseRetorno(rows: unknown[][]): {
  resumo: RetornoResumo | null;
  ofensores: RetornoOfensor[];
  motivos: RetornoMotivo[];
} {
  const periodo_nota = cell(rows[1], 0) || cell(rows[0], 0);
  const triple = (row: unknown[]) => ({
    canoas: num(row[2]),
    poa: num(row[3]),
    total: num(row[4]),
  });

  let retornos_concluidos = { canoas: 0, poa: 0, total: 0 };
  let retornos_gerados = { canoas: 0, poa: 0, total: 0 };
  let pai_diferente = { canoas: 0, poa: 0, total: 0 };
  let pai_igual = { canoas: 0, poa: 0, total: 0 };
  let pai_nao_id = { canoas: 0, poa: 0, total: 0 };
  let maior_motivo = "";

  for (let i = 0; i < rows.length; i++) {
    const label = (cell(rows[i], 0) || "").toUpperCase();
    const row = rows[i] || [];
    if (label.startsWith("RETORNOS CONCLU")) retornos_concluidos = triple(row);
    else if (label.startsWith("RETORNOS GERADOS")) retornos_gerados = triple(row);
    else if (label.startsWith("PAI ≠") || label.startsWith("PAI !=") || label.includes("PAI ≠ QUEM"))
      pai_diferente = triple(row);
    else if (label.startsWith("PAI = QUEM") || label.includes("VOLTOU NO PRÓPRIO"))
      pai_igual = triple(row);
    else if (label.startsWith("PAI NÃO IDENT") || label.startsWith("PAI NAO IDENT"))
      pai_nao_id = triple(row);
    else if (label.startsWith("MAIOR MOTIVO"))
      maior_motivo = cell(row, 4) || cell(row, 2);
  }

  const ofensores: RetornoOfensor[] = [];
  let inOfensor = false;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("OFENSOR") && t.includes("TÉCNICO PAI")) {
      inOfensor = true;
      continue;
    }
    if (inOfensor && (t.includes("MOTIVOS DO RETORNO") || t.startsWith("3."))) {
      inOfensor = false;
    }
    if (!inOfensor) continue;
    const pos = cell(rows[i], 0);
    if (pos.toUpperCase() === "POS." || pos.toUpperCase() === "TOTAL") continue;
    if (!pos || (pos !== "—" && !/\d/.test(pos) && pos !== "-")) continue;
    if (pos.toUpperCase() === "TOTAL" || cell(rows[i], 1).toUpperCase() === "TOTAL") continue;
    const row = rows[i] || [];
    if (!cell(row, 1) && pos === "—") {
      ofensores.push({
        pos: "—",
        tecnico: cell(row, 1) || "não identificado",
        base: cell(row, 2) || "—",
        login: cell(row, 3) || "—",
        retornos: num(row[4]),
        maior_motivo: cell(row, 5),
        qtd_motivo: num(row[6]),
        atendidos_outro: num(row[7]),
        sobre_409: num(row[8]),
      });
      continue;
    }
    if (!cell(row, 1)) continue;
    ofensores.push({
      pos,
      tecnico: cell(row, 1),
      base: cell(row, 2),
      login: cell(row, 3),
      retornos: num(row[4]),
      maior_motivo: cell(row, 5),
      qtd_motivo: num(row[6]),
      atendidos_outro: num(row[7]),
      sobre_409: num(row[8]),
    });
  }

  const motivos: RetornoMotivo[] = [];
  let inMotivos = false;
  for (let i = 0; i < rows.length; i++) {
    const t = rowText(rows[i]);
    if (t.includes("MOTIVOS DO RETORNO")) {
      inMotivos = true;
      continue;
    }
    if (inMotivos && (t.includes("DETALHE DOS RETORNOS") || t.startsWith("4."))) {
      inMotivos = false;
    }
    if (!inMotivos) continue;
    const codigo = cell(rows[i], 0);
    if (!codigo || codigo.toUpperCase() === "CÓDIGO" || codigo.toUpperCase() === "CODIGO")
      continue;
    if (codigo.toUpperCase() === "TOTAL") continue;
    if (!/^\d+$/.test(codigo)) continue;
    const row = rows[i] || [];
    motivos.push({
      codigo,
      descricao: cell(row, 1),
      canoas: num(row[2]),
      poa: num(row[3]),
      total: num(row[4]),
    });
  }

  const resumo: RetornoResumo | null = retornos_concluidos.total
    ? {
        retornos_concluidos,
        retornos_gerados,
        pai_diferente,
        pai_igual,
        pai_nao_id,
        maior_motivo,
        periodo_nota,
      }
    : null;

  return { resumo, ofensores, motivos };
}

export function filterIatBlocks(
  blocos: IatBlock[],
  base: IatBase,
): IatBlock[] {
  if (base === "TOTAL") return blocos;
  return blocos.filter((b) => b.base === base);
}

export function emptyIatPayload(
  mes: string,
  mensagem?: string,
): IatPayload {
  return {
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem,
    titulo: "IAT",
    mes,
    mes_aba: null,
    blocos: [],
    resumo: [],
    ranking: [],
    painel_ok: { resumo: null, tecnicos: [] },
    retorno: { resumo: null, ofensores: [], motivos: [] },
    equipe: [],
  };
}
