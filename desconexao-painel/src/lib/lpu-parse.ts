/** Parse LPU Desconexão e IAT (só leitura; títulos internos de aba Sheets). */

export type LpuItem = {
  codigo: string;
  descricao: string;
  preco: number | null;
  situacao: string;
  foldDesc: string;
};

function fold(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function money(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "").trim();
}

/** LPU Desconexão: Descrição | Preço bruto. */
export function parseLpuDesconexao(rows: unknown[][]): LpuItem[] {
  const items: LpuItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const desc = cell(rows[i], 0);
    if (!desc) continue;
    const u = fold(desc);
    if (u.startsWith("DESCRI") || u.startsWith("PRECO")) continue;
    const preco = money(rows[i]?.[1]);
    const codigoMatch = desc.match(/^([\d.]+)\s*[-–—]/);
    const codigo = codigoMatch ? codigoMatch[1] : desc.slice(0, 12);
    items.push({
      codigo,
      descricao: desc,
      preco,
      situacao: preco == null ? "Sem valor informado" : "Tabela",
      foldDesc: fold(desc),
    });
  }
  return items;
}

/** LPU IAT: ITEM | DESCRIÇÃO | tempo | VALOR | SITUAÇÃO. */
export function parseLpuIat(rows: unknown[][]): {
  items: LpuItem[];
  valorHora: number | null;
} {
  let valorHora: number | null = null;
  const items: LpuItem[] = [];
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    for (let c = 0; c < (rows[i] || []).length; c++) {
      if (fold(rows[i]?.[c]).includes("VALOR HS")) {
        valorHora = money(rows[i]?.[c + 1]);
      }
    }
  }
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (fold(rows[i]?.[0]) === "ITEM") {
      header = i;
      break;
    }
  }
  const start = header >= 0 ? header + 1 : 1;
  for (let i = start; i < rows.length; i++) {
    const codigo = cell(rows[i], 0).replace(/\s/g, "");
    const desc = cell(rows[i], 1);
    if (!codigo && !desc) continue;
    if (fold(codigo) === "ITEM") continue;
    const preco = money(rows[i]?.[3]);
    const situacao = cell(rows[i], 4) || (preco == null ? "Sem valor informado" : "Tabela");
    items.push({
      codigo: codigo || "—",
      descricao: desc || codigo,
      preco,
      situacao,
      foldDesc: fold(desc || codigo),
    });
  }
  return { items, valorHora };
}

/** Menor preço positivo da LPU Desconexão (entrega de controle). */
export function menorPrecoDesconexao(items: LpuItem[]): number | null {
  let min: number | null = null;
  for (const it of items) {
    if (it.preco == null || it.preco <= 0) continue;
    if (min == null || it.preco < min) min = it.preco;
  }
  return min;
}

/**
 * Preço operacional Desconexão (regras VALORES / briefing C.1) usando preços LPU.
 * Retorna código LPU representativo + preço.
 */
export function precoDesconexaoPorServico(
  servicoRaw: string,
  lpu: LpuItem[],
  menor: number | null,
): { codigo: string; descricao: string; preco: number | null; sem_preco: boolean } {
  const u = fold(servicoRaw);
  if (!u || u.includes("SMART CARD")) {
    return {
      codigo: "—",
      descricao: servicoRaw || "SMART CARD",
      preco: null,
      sem_preco: true,
    };
  }
  const find = (pred: (it: LpuItem) => boolean) => lpu.find(pred);

  if (u.includes("CONTROLE") || u.includes("ENTREGA DE CONTROLE")) {
    const it =
      find((x) => x.foldDesc.includes("VAS VIA MOTO") && x.foldDesc.includes("AGREGADA")) ||
      find((x) => x.preco === menor);
    return {
      codigo: it?.codigo || "min",
      descricao: it?.descricao || "Menor valor LPU (entrega de controle)",
      preco: menor,
      sem_preco: menor == null,
    };
  }
  if (u.includes("REINSTAL")) {
    const it =
      find((x) => x.foldDesc.includes("ENTREGA EXPRESS KIT")) ||
      find((x) => x.preco === 30);
    return {
      codigo: it?.codigo || "reinst",
      descricao: it?.descricao || "REINSTALAÇÃO (= instalação)",
      preco: it?.preco ?? 30,
      sem_preco: false,
    };
  }
  if (u.includes("TROCA")) {
    const it = find(
      (x) =>
        x.foldDesc.includes("REVERSA") && x.foldDesc.includes("DESLOCAMENTO"),
    );
    return {
      codigo: it?.codigo || "20.21",
      descricao: it?.descricao || "20.21-ENTREGA COM REVERSA — DESLOCAMENTO",
      preco: it?.preco ?? 31.9,
      sem_preco: false,
    };
  }
  if (u.includes("INSTAL")) {
    const it =
      find((x) => x.foldDesc.includes("ENTREGA EXPRESS KIT")) ||
      find((x) => x.preco === 30);
    return {
      codigo: it?.codigo || "20.14",
      descricao: it?.descricao || "INSTALAÇÃO",
      preco: it?.preco ?? 30,
      sem_preco: false,
    };
  }
  if (u.includes("DESCON") || u.includes("RETIR")) {
    const it = find((x) => x.foldDesc.includes("RETIRAR EQUIPAMENTO"));
    return {
      codigo: it?.codigo || "20.4",
      descricao: it?.descricao || "20.4-RETIRAR EQUIPAMENTO",
      preco: it?.preco ?? 41.5,
      sem_preco: false,
    };
  }
  // Desconhecido → 41,50 com aviso (regra VALORES)
  const it = find((x) => x.foldDesc.includes("RETIRAR EQUIPAMENTO"));
  return {
    codigo: it?.codigo || "20.4",
    descricao: `${servicoRaw || "SERVIÇO DESCONHECIDO"} → padrão retirada`,
    preco: it?.preco ?? 41.5,
    sem_preco: false,
  };
}

/**
 * Match Tipo O.S (TOA) → item LPU IAT by description (+ CASA/APTO).
 * TOA codes (1, 43…) ≠ LPU items (1,3); match by folded description.
 */
export function matchLpuIat(
  osRaw: string,
  lpu: LpuItem[],
  complemento: string,
): { item: LpuItem | null; ambiguous: boolean } {
  const raw = String(osRaw || "").trim();
  if (!raw) return { item: null, ambiguous: false };
  const m = raw.match(/^\s*([\d.,]+)\s*[-–—]?\s*(.*)$/);
  const codePart = (m?.[1] || "").replace(/\./g, ",").replace(/\s/g, "");
  const descPart = fold(m?.[2] || raw);
  if (!descPart && !codePart) return { item: null, ambiguous: false };

  // Exact LPU item code (ex. "1,3")
  if (codePart.includes(",")) {
    const byCode = lpu.find((it) => it.codigo.replace(/\s/g, "") === codePart);
    if (byCode) return { item: byCode, ambiguous: false };
  }

  const endClass = (() => {
    const c = fold(complemento);
    if (/APT|\bBL\b|TORRE|SALA|LOJA|EDIFIC/.test(c)) return "APTO";
    if (c.includes("CASA")) return "CASA";
    return "";
  })();

  let candidates = lpu.filter((it) => {
    if (!it.foldDesc) return false;
    if (descPart && it.foldDesc.includes(descPart)) return true;
    if (descPart && descPart.includes(it.foldDesc) && it.foldDesc.length >= 12)
      return true;
    // loose: all significant tokens
    const tokens = descPart.split(" ").filter((t) => t.length > 3);
    if (tokens.length < 2) return false;
    return tokens.every((t) => it.foldDesc.includes(t));
  });

  if (endClass && candidates.length > 1) {
    const narrowed = candidates.filter((it) => it.foldDesc.includes(endClass));
    if (narrowed.length) candidates = narrowed;
  }

  if (candidates.length === 1) return { item: candidates[0], ambiguous: false };
  if (candidates.length > 1) {
    // Prefer exact-ish: LPU desc without extra tokens beyond OS desc + CASA/APTO
    const priced = candidates.filter((c) => c.preco != null);
    if (priced.length === 1) return { item: priced[0], ambiguous: false };
    // Ambíguo → não assumir preço (pedido: sem preço, não inventar)
    return { item: null, ambiguous: true };
  }
  return { item: null, ambiguous: false };
}
