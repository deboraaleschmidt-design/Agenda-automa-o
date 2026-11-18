import { num } from "./painel-parse";

export type HistLinha = {
  atividade: string;
  qtde: number;
  valor_unit: string;
  total: string;
  sem_preco: boolean;
};

export type HistMesBlock = {
  chave: "SET" | "OUT" | "NOV" | string;
  titulo: string;
  visitas: number;
  linhas: HistLinha[];
  subtotal_qtde: number;
  subtotal_valor: string;
};

export type HistCard = {
  tecnico: string;
  vinculo: "PJ" | "CLT" | string;
  atividades: number;
  tarefas: number;
  meses: HistMesBlock[];
  total_qtde: number;
  total_valor: string;
};

export type HistTecnicoPayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  titulo: string;
  periodo_nota: string;
  ordem_nota: string;
  cards: HistCard[];
  meses_disponiveis: string[];
};

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isSemPreco(v: string): boolean {
  return fold(v).includes("SEM PRECO");
}

function parseVisitas(titulo: string): number {
  const m = titulo.match(/(\d+)\s*visitas?/i);
  return m ? Number(m[1]) : 0;
}

function mesChave(titulo: string): string {
  const u = fold(titulo);
  if (u.includes("SETEMBRO") || u.startsWith("SET")) return "SET";
  if (u.includes("OUTUBRO") || u.startsWith("OUT")) return "OUT";
  if (u.includes("NOVEMBRO") || u.startsWith("NOV")) return "NOV";
  return titulo.slice(0, 12) || "—";
}

function parsePeriodo(txt: string): { atividades: number; tarefas: number } {
  const a = txt.match(/(\d+)\s*atividades?/i);
  const t = txt.match(/(\d+)\s*tarefas?/i);
  return { atividades: a ? Number(a[1]) : 0, tarefas: t ? Number(t[1]) : 0 };
}

function isNameRow(row: unknown[], offset: number): boolean {
  const nome = cell(row, offset);
  const vinculo = fold(cell(row, offset + 3));
  if (!nome || nome.length < 3) return false;
  if (fold(nome).startsWith("PERIODO")) return false;
  if (fold(nome).startsWith("SETEMBRO") || fold(nome).startsWith("OUTUBRO"))
    return false;
  if (fold(nome).startsWith("NOVEMBRO") || fold(nome).startsWith("SUBTOTAL"))
    return false;
  if (fold(nome).startsWith("TOTAL") || fold(nome).startsWith("ORDEM"))
    return false;
  return vinculo === "PJ" || vinculo === "CLT";
}

function parseCardAt(
  rows: unknown[][],
  start: number,
  offset: number,
): HistCard | null {
  const head = rows[start] || [];
  if (!isNameRow(head, offset)) return null;
  const tecnico = cell(head, offset);
  const vinculo = fold(cell(head, offset + 3)) || "—";
  let atividades = 0;
  let tarefas = 0;
  const meses: HistMesBlock[] = [];
  let total_qtde = 0;
  let total_valor = "—";

  let cur: HistMesBlock | null = null;

  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    // Próximo bloco de nomes (nova fileira de cards)
    if (
      isNameRow(row, 0) ||
      isNameRow(row, 5) ||
      isNameRow(row, 10)
    ) {
      if (i > start + 1) break;
    }
    const a0 = cell(row, offset);
    const a0u = fold(a0);
    if (!a0 && !cell(row, offset + 1) && !cell(row, offset + 2)) {
      // linha vazia no card — pode ser espaçador entre meses
      continue;
    }
    if (a0u.startsWith("PERIODO")) {
      const p = parsePeriodo(a0);
      atividades = p.atividades;
      tarefas = p.tarefas;
      continue;
    }
    if (
      a0u.startsWith("SETEMBRO") ||
      a0u.startsWith("OUTUBRO") ||
      a0u.startsWith("NOVEMBRO")
    ) {
      if (cur) meses.push(cur);
      cur = {
        chave: mesChave(a0),
        titulo: a0,
        visitas: parseVisitas(a0),
        linhas: [],
        subtotal_qtde: 0,
        subtotal_valor: "—",
      };
      continue;
    }
    if (a0u.startsWith("SUBTOTAL")) {
      if (cur) {
        cur.subtotal_qtde = num(row[offset + 1]);
        cur.subtotal_valor = cell(row, offset + 3) || "—";
        meses.push(cur);
        cur = null;
      }
      continue;
    }
    if (a0u.startsWith("TOTAL DO PERIODO") || a0u.startsWith("TOTAL DO PERÍODO")) {
      total_qtde = num(row[offset + 1]);
      total_valor = cell(row, offset + 3) || "—";
      if (cur) {
        meses.push(cur);
        cur = null;
      }
      break;
    }
    if (cur && a0) {
      const valor_unit = cell(row, offset + 2) || "—";
      const total = cell(row, offset + 3) || "—";
      cur.linhas.push({
        atividade: a0,
        qtde: num(row[offset + 1]),
        valor_unit,
        total,
        sem_preco: isSemPreco(valor_unit) || isSemPreco(total),
      });
    }
  }
  if (cur) meses.push(cur);

  return {
    tecnico,
    vinculo,
    atividades,
    tarefas,
    meses,
    total_qtde,
    total_valor,
  };
}

function isPjVinculo(v: string): boolean {
  return fold(v) === "PJ";
}

/** Debora 18/11 18:23: PJ por atividades desc, depois CLT desc. */
export function sortHistoricoCards(cards: HistCard[]): HistCard[] {
  return [...cards].sort((a, b) => {
    const aPj = isPjVinculo(a.vinculo) ? 0 : 1;
    const bPj = isPjVinculo(b.vinculo) ? 0 : 1;
    if (aPj !== bPj) return aPj - bPj;
    return (
      b.atividades - a.atividades ||
      fold(a.tecnico).localeCompare(fold(b.tecnico))
    );
  });
}

/** Layout atual: 3 cards/fileira com 4 cols + 1 spacer (A–D · F–I · K–N). */
const CARD_OFFSETS = [0, 5, 10] as const;

/**
 * Espelho da aba HISTÓRICO TÉCNICO (cards 3 por fileira).
 * Ordem de exibição: PJ atividades desc → CLT atividades desc.
 */
export function parseHistoricoTecnico(rows: unknown[][]): {
  titulo: string;
  periodo_nota: string;
  ordem_nota: string;
  cards: HistCard[];
} {
  const titulo = cell(rows[0], 0) || "HISTÓRICO TÉCNICO";
  const periodo_nota = cell(rows[1], 0) || cell(rows[3], 0) || "";
  const ordem_nota =
    "ORDEM ▸ PJ (maior → menor nº de atividades)  ·  depois CLT (maior → menor)";
  const cards: HistCard[] = [];
  const seen = new Set<string>();

  for (let i = 5; i < rows.length; i++) {
    const row = rows[i] || [];
    for (const offset of CARD_OFFSETS) {
      if (!isNameRow(row, offset)) continue;
      const card = parseCardAt(rows, i, offset);
      if (!card) continue;
      const key = fold(card.tecnico);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  }

  return {
    titulo,
    periodo_nota,
    ordem_nota,
    cards: sortHistoricoCards(cards),
  };
}

export function emptyHistTecnicoPayload(mensagem?: string): HistTecnicoPayload {
  return {
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem,
    titulo: "HISTÓRICO TÉCNICO",
    periodo_nota: "",
    ordem_nota: "",
    cards: [],
    meses_disponiveis: ["TOTAL", "2026-09", "2026-10", "2026-11"],
  };
}

/** Filtra linhas de mês no card (TOTAL = todos). */
export function filterCardMes(card: HistCard, mes: string): HistCard {
  if (mes.trim().toUpperCase() === "TOTAL") return card;
  const map: Record<string, string> = {
    "2026-09": "SET",
    "2026-10": "OUT",
    "2026-11": "NOV",
  };
  const want = map[mes.trim()] || mes.trim().toUpperCase();
  const meses = card.meses.filter((m) => m.chave === want);
  const subQ = meses.reduce((s, m) => s + m.subtotal_qtde, 0);
  const subV =
    meses.length === 1
      ? meses[0].subtotal_valor
      : meses.map((m) => m.subtotal_valor).join(" · ") || "—";
  return {
    ...card,
    meses,
    total_qtde: subQ || card.total_qtde,
    total_valor: subV,
  };
}
