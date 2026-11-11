/** Canonical service labels from Respostas column SERVIÇO (col L). */
export const TIPOS_SERVICO = [
  "DESCONEXÃO",
  "RETIRADA",
  "INSTALAÇÃO",
  "TROCA PACOTE/TECNOLOGIA",
] as const;

export type TipoServico = (typeof TIPOS_SERVICO)[number];

export type ContagemServico = {
  tipo: string;
  quantidade: number;
};

export function emptyServicoCounts(): Record<TipoServico, number> {
  return {
    DESCONEXÃO: 0,
    RETIRADA: 0,
    INSTALAÇÃO: 0,
    "TROCA PACOTE/TECNOLOGIA": 0,
  };
}

export function normalizeServico(raw: unknown): TipoServico | "OUTROS" {
  const u = String(raw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (!u) return "OUTROS";
  if (u.indexOf("TROCA") === 0 || u.indexOf("TROCA") >= 0) {
    return "TROCA PACOTE/TECNOLOGIA";
  }
  if (u.indexOf("INSTAL") === 0 || u.indexOf("INSTAL") >= 0) {
    return "INSTALAÇÃO";
  }
  if (u.indexOf("DESCON") === 0 || u.indexOf("DESCON") >= 0) {
    return "DESCONEXÃO";
  }
  if (u.indexOf("RETIR") === 0 || u.indexOf("RETIR") >= 0) {
    return "RETIRADA";
  }
  return "OUTROS";
}

export function countsToList(
  counts: Record<string, number>,
): ContagemServico[] {
  const list: ContagemServico[] = TIPOS_SERVICO.map((tipo) => ({
    tipo,
    quantidade: counts[tipo] || 0,
  }));
  const outros = counts.OUTROS || 0;
  if (outros > 0) list.push({ tipo: "OUTROS", quantidade: outros });
  return list;
}

/** Parse YYYY-MM from cell date / display / period label (FATURAR). */
export function monthKeyFromCell(
  data: unknown,
  period: unknown,
): { y: number; m: number } | null {
  if (data instanceof Date && !Number.isNaN(data.getTime())) {
    return { y: data.getFullYear(), m: data.getMonth() + 1 };
  }
  if (typeof data === "number" && Number.isFinite(data)) {
    // Sheets serial date
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + data * 86400000);
    if (!Number.isNaN(d.getTime())) {
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    }
  }
  const s = String(data || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return { y, m: parseInt(m[2], 10) };
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { y: parseInt(iso[1], 10), m: parseInt(iso[2], 10) };
  }
  const p = String(period || "").toUpperCase();
  const names: Record<string, number> = {
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
    JANEIRO: 1,
    FEVEREIRO: 2,
    MARÇO: 3,
    MARCO: 3,
    ABRIL: 4,
    MAIO: 5,
    JUNHO: 6,
    JULHO: 7,
    AGOSTO: 8,
    SETEMBRO: 9,
    OUTUBRO: 10,
    NOVEMBRO: 11,
    DEZEMBRO: 12,
  };
  for (const [k, month] of Object.entries(names)) {
    if (p.indexOf(k) >= 0) {
      const ys = p.match(/20\d{2}/);
      return { y: ys ? parseInt(ys[0], 10) : 2026, m: month };
    }
  }
  return null;
}

export function parseMesParam(mes: string): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(mes.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (m < 1 || m > 12) return null;
  return { y, m };
}

export function mapRespostasHeader(head: unknown[]): {
  period: number;
  ts: number;
  serial: number;
  servico: number;
  data: number;
  statusEntrega: number;
} {
  const norm = (s: unknown) =>
    String(s || "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  const idx = (preds: string[]) => {
    for (let c = 0; c < head.length; c++) {
      const h = norm(head[c]);
      for (const p of preds) {
        if (h.indexOf(p) >= 0) return c;
      }
    }
    return -1;
  };
  let serialIdx = idx(["SERIAL"]);
  for (let c = 0; c < head.length; c++) {
    const h = norm(head[c]);
    if (
      h === "SERIAL" ||
      (h.indexOf("SERIAL") >= 0 &&
        h.indexOf("SMART") < 0 &&
        h.indexOf("FOTO") < 0)
    ) {
      serialIdx = c;
      break;
    }
  }
  let dataIdx = -1;
  for (let c = 0; c < head.length; c++) {
    if (norm(head[c]) === "DATA") {
      dataIdx = c;
      break;
    }
  }
  if (dataIdx < 0) dataIdx = idx(["DATA"]);
  let statusEntrega = -1;
  for (let c = 0; c < head.length; c++) {
    const h = norm(head[c]);
    if (h.indexOf("STATUS") >= 0 && h.indexOf("ENTREG") >= 0) {
      statusEntrega = c;
      break;
    }
  }
  return {
    period: idx(["FATURAR"]) >= 0 ? idx(["FATURAR"]) : 0,
    ts: idx(["CARIMBO", "DATA/HORA"]),
    serial: serialIdx,
    servico: idx(["SERVIÇO", "SERVICO"]),
    data: dataIdx,
    statusEntrega,
  };
}
