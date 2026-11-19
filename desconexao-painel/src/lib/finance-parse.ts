import { num } from "./painel-parse";

export type APagarLinha = {
  tecnico: string;
  volume: number;
  unitario: number;
  valor: number;
  status: string;
  /** Período da planilha (ex.: 01/11–17/11 12:30). */
  periodo?: string;
  /** Bloco de origem (HISTÓRICO RECOLHAS ou PAINEL RECOLHAS). */
  bloco?: "vigente" | "fechamento" | "em_atraso" | "legado" | "historico";
  classificacao?: string;
  pagas?: number;
  nao_pagas?: number;
  /** YYYY-MM do bloco mensal na planilha. */
  mes_ym?: string;
};

export type APagarParse = {
  titulo: string;
  /** Quinzena vigente na planilha (1/2), se detectada. */
  quinzena: 1 | 2 | null;
  /** Espelho principal = quinzena vigente (ou layout legado). */
  linhas: APagarLinha[];
  vigente: APagarLinha[];
  fechamento: APagarLinha[];
  em_atraso: APagarLinha[];
  total: number;
  total_fechamento: number;
  total_atraso: number;
};

export type FaturamentoMes = {
  mes: string;
  recolhas: number;
  faturamento: number;
  unitario_medio: number;
  periodo: string;
};

export type FinanceSegmento = "desconexao" | "iat" | "neutra" | "todos";

export type FinanceAtividade = {
  segmento: "desconexao" | "iat" | "neutra";
  codigo: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number | null;
  valor: number | null;
  sem_preco: boolean;
  origem_lpu: string;
};

export type FinanceTechOk = {
  segmento: "neutra";
  nome: string;
  tt: string;
  area: string;
  servicos_ok: number;
  valor: number;
};

export type FinanceSubtotal = {
  servicos: number;
  valor_faturar: number;
  sem_preco: number;
  a_pagar: number | null;
};

export type QuinzenaPagLinha = {
  tecnico: string;
  tipo: "PJ" | "CLT" | "parceiro" | "sem_custo";
  atividades: number;
  valor: number | null;
  nota?: string;
};

export type QuinzenaBloco = {
  id: "1a" | "2a";
  titulo: string;
  corte: string;
  pago_em: string;
  linhas: QuinzenaPagLinha[];
  total: number;
};

export type OpexLinha = {
  tecnico: string;
  categoria: "PJ" | "CLT" | "parceiro" | "sem_custo";
  detalhe: string;
  valor: number | null;
};

export type OpexBloco = {
  receita: number;
  custo_pj: number;
  custo_clt: number;
  custo_parceiro: number;
  custo_total: number;
  lucro: number;
  margem: number | null;
  sem_preco: number;
  linhas: OpexLinha[];
  salario_clt: number;
  rate_pj: number;
};

export type FinancePayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  mes: string;
  segmento: FinanceSegmento;
  meses_disponiveis: string[];
  /** Setores conhecidos + reserva para novos. */
  setores: Array<{ id: FinanceSegmento | string; label: string }>;
  lpu_origem: {
    desconexao: string;
    iat: string;
    neutra: string;
    valor_hora_iat: number | null;
  };
  atividades: FinanceAtividade[];
  subtotais: {
    desconexao: FinanceSubtotal;
    iat: FinanceSubtotal;
    neutra: FinanceSubtotal;
    geral: FinanceSubtotal;
  };
  /** Total OK TCI por técnico (Neutra). */
  ok_tci_tecnicos: FinanceTechOk[];
  quinzena_titulo: string;
  a_pagar: APagarLinha[];
  total_a_pagar: number;
  /** IAT: sem regra de pagamento na planilha. */
  a_pagar_iat_nota: string;
  /**
   * Recolhas a pagar (em aberto): pendente vs fechado/pago
   * (PAINEL RECOLHAS · blocos vigente/atraso × fechamento).
   */
  recolhas_aberto: {
    titulo: string;
    pendentes: APagarLinha[];
    fechados: APagarLinha[];
  } | null;
  faturamento_meses: FaturamentoMes[];
  faturamento_ago_mais: { recolhas: number; valor: number };
  /** Prévia OPEX 17/11: quinzenas PJ + mensal + custo×receita. */
  pagamento_quinzenas: QuinzenaBloco[];
  visao_mensal: {
    titulo: string;
    total_pago: number;
    linhas: QuinzenaPagLinha[];
  };
  opex: OpexBloco | null;
  duvidas: string[];
  gabriel_nota?: string;
};

export function emptyFinancePayload(
  mes: string,
  segmento: FinanceSegmento,
  mensagem: string,
): FinancePayload {
  const zero: FinanceSubtotal = {
    servicos: 0,
    valor_faturar: 0,
    sem_preco: 0,
    a_pagar: null,
  };
  return {
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem,
    mes,
    segmento,
    meses_disponiveis: [],
    setores: [
      { id: "desconexao", label: "DESCONEXÃO" },
      { id: "iat", label: "IAT" },
      { id: "neutra", label: "NEUTRA" },
      { id: "todos", label: "TODOS" },
    ],
    lpu_origem: {
      desconexao: "LPU · Desconexão",
      iat: "LPU · IAT",
      neutra: "LPU · Neutra (TELEMONT 1)",
      valor_hora_iat: null,
    },
    atividades: [],
    subtotais: {
      desconexao: zero,
      iat: { ...zero },
      neutra: { ...zero },
      geral: { ...zero },
    },
    ok_tci_tecnicos: [],
    quinzena_titulo: "",
    a_pagar: [],
    total_a_pagar: 0,
    a_pagar_iat_nota:
      "Pagamento a técnico IAT: NÃO INFORMADO na planilha — só faturamento LPU.",
    recolhas_aberto: null,
    faturamento_meses: [],
    faturamento_ago_mais: { recolhas: 0, valor: 0 },
    pagamento_quinzenas: [],
    visao_mensal: { titulo: "", total_pago: 0, linhas: [] },
    opex: null,
    duvidas: [],
  };
}

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

/** Aceita BR (1.450,00) ou US (1230.00) — status do HISTÓRICO mistura os dois. */
function moneyLoose(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = String(v || "")
    .replace(/R\$\s?/gi, "")
    .trim();
  if (!t) return 0;
  if (t.includes(",")) return money(t);
  const n = Number(t.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Quantidade (recolhas) — aceita "10", "R$ 55,00" (formato Sheets) ou número. */
function qty(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function foldHeader(row: unknown[] | undefined): string {
  return (row || [])
    .map((c) => String(c ?? "").trim())
    .join(" | ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function detectQuinzena(text: string): 1 | 2 | null {
  const u = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const m = u.match(/QUINZENA\s*(?:VIGENTE\s*)?(\d)/);
  if (m) return Number(m[1]) === 2 ? 2 : 1;
  if (u.includes("16/11") || u.includes("16–FIM") || u.includes("16-FIM"))
    return 2;
  if (u.includes("1–15") || u.includes("1-15") || u.includes("01–15"))
    return 1;
  return null;
}

function isTechHeader(a: string): boolean {
  const u = a
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return u === "TECNICO" || u.startsWith("TECNICO (");
}

type BlockKind = "fechamento" | "em_atraso" | "vigente" | "legado" | "skip";

function classifyHeader(headerRow: unknown[], titleAbove: string): BlockKind {
  const h = foldHeader(headerRow);
  const t = titleAbove
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (h.includes("CLASSIFICACAO") || h.includes("RECONHECIDO")) return "skip";
  if (h.includes("SERIAL") && h.includes("SITUACAO")) return "skip";
  if (
    t.includes("FECHADAS") ||
    t.includes("EM ATRASO") ||
    h.includes("DIAS EM ATRASO") ||
    h.includes("FECHOU EM")
  ) {
    return "em_atraso";
  }
  if (
    t.includes("FECHAMENTO") ||
    (h.includes("PERIODO") &&
      (h.includes("TOTAL A PAGAR") || h.includes("JA MARCADAS")))
  ) {
    return "fechamento";
  }
  if (
    h.includes("RECOLHAS EM ABERTO") ||
    t.includes("QUINZENA VIGENTE") ||
    t.includes("A PAGAR (EM ABERTO)")
  ) {
    return "vigente";
  }
  // Layout legado: Técnico | Recolhas | Unitário | A PAGAR | Status
  if (
    h.includes("RECOLHAS") &&
    h.includes("UNIT") &&
    (h.includes("A PAGAR") || h.includes("STATUS"))
  ) {
    return "legado";
  }
  return "skip";
}

function parseBlockRows(
  rows: unknown[][],
  headerIdx: number,
  kind: Exclude<BlockKind, "skip">,
): { linhas: APagarLinha[]; total: number } {
  const header = foldHeader(rows[headerIdx]);
  // Colunas por bloco (PAINEL RECOLHAS v20+).
  let iPeriodo = -1;
  let iVol = 1;
  let iUnit = 2;
  let iValor = 3;
  let iStatus = 4;
  if (kind === "fechamento" || kind === "em_atraso") {
    // Técnico | Período | Recolhas | Unitário | Total/A pagar | … | Situação/Status
    iPeriodo = 1;
    iVol = 2;
    iUnit = 3;
    iValor = 4;
    iStatus = kind === "fechamento" ? 7 : 7;
  } else {
    // vigente/legado: Técnico | Recolhas [em aberto] | Unitário | A PAGAR | Status
    iVol = 1;
    iUnit = 2;
    iValor = 3;
    iStatus = 4;
  }
  // Ajuste se cabeçalho tiver labels explícitos
  const cells = (rows[headerIdx] || []).map((c) =>
    String(c ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim(),
  );
  for (let c = 0; c < cells.length; c++) {
    const u = cells[c];
    if (u.startsWith("PERIODO")) iPeriodo = c;
    if (u.startsWith("RECOLHAS")) iVol = c;
    if (u.startsWith("UNIT")) iUnit = c;
    if (
      u === "A PAGAR" ||
      u.startsWith("TOTAL A PAGAR") ||
      u === "TOTAL A PAGAR"
    )
      iValor = c;
    if (u === "STATUS" || u.startsWith("SITUACAO")) iStatus = c;
  }
  void header;

  const linhas: APagarLinha[] = [];
  let total = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const nome = cell(rows[i], 0);
    if (!nome) break;
    const u = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (u.includes("SERIAL") || u.includes("CONFER")) break;
    if (isTechHeader(nome)) break;
    if (
      u.startsWith("FECHAMENTO") ||
      u.startsWith("FECHADAS") ||
      u.startsWith("QUINZENA") ||
      u.startsWith("TECNICOS DO MES") ||
      u.startsWith("PAINEL DE RECOLHAS")
    ) {
      break;
    }
    if (u.startsWith("TOTAL")) {
      total = money(rows[i]?.[iValor]);
      if (!total) total = money(rows[i]?.[3]) || money(rows[i]?.[4]);
      break;
    }
    linhas.push({
      tecnico: nome,
      volume: qty(rows[i]?.[iVol]),
      unitario: money(rows[i]?.[iUnit]),
      valor: money(rows[i]?.[iValor]),
      status: cell(rows[i], iStatus) || (kind === "vigente" ? "A PAGAR" : ""),
      periodo: iPeriodo >= 0 ? cell(rows[i], iPeriodo) : undefined,
      bloco: kind,
    });
  }
  if (!total) total = linhas.reduce((s, l) => s + l.valor, 0);
  return { linhas, total };
}

/**
 * PAINEL RECOLHAS — A PAGAR.
 * Layout v20+: FECHAMENTO + EM ATRASO + QUINZENA VIGENTE (cols A–H).
 * Layout legado: um bloco Técnico|Recolhas|Unitário|A PAGAR|Status.
 */
export function parseAPagar(rows: unknown[][]): APagarParse {
  const titulo = cell(rows[0], 0) || "A pagar";
  let quinzena = detectQuinzena(titulo);

  const vigente: APagarLinha[] = [];
  const fechamento: APagarLinha[] = [];
  const em_atraso: APagarLinha[] = [];
  let total = 0;
  let total_fechamento = 0;
  let total_atraso = 0;
  let legado: APagarLinha[] = [];
  let totalLegado = 0;

  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0);
    if (!isTechHeader(a)) {
      // Título de bloco pode trazer quinzena vigente
      const q = detectQuinzena(a);
      if (
        q &&
        (a.toUpperCase().includes("VIGENTE") ||
          a.toUpperCase().includes("QUINZENA VIGENTE") ||
          a.toUpperCase().includes("A PAGAR"))
      ) {
        quinzena = q;
      }
      continue;
    }
    let titleAbove = "";
    for (let j = i - 1; j >= 0; j--) {
      const t = cell(rows[j], 0);
      if (t) {
        titleAbove = t;
        break;
      }
    }
    const kind = classifyHeader(rows[i], titleAbove);
    if (kind === "skip") continue;
    const parsed = parseBlockRows(rows, i, kind);
    if (kind === "fechamento") {
      fechamento.push(...parsed.linhas);
      total_fechamento = parsed.total || total_fechamento;
    } else if (kind === "em_atraso") {
      em_atraso.push(...parsed.linhas);
      total_atraso = parsed.total || total_atraso;
    } else if (kind === "vigente") {
      vigente.push(...parsed.linhas);
      total = parsed.total || total;
      if (!quinzena) quinzena = detectQuinzena(titleAbove) || detectQuinzena(titulo);
    } else {
      legado = parsed.linhas;
      totalLegado = parsed.total;
    }
  }

  const linhas = vigente.length ? vigente : legado;
  if (!total) total = vigente.length ? vigente.reduce((s, l) => s + l.valor, 0) : totalLegado;
  if (!total_fechamento)
    total_fechamento = fechamento.reduce((s, l) => s + l.valor, 0);
  if (!total_atraso) total_atraso = em_atraso.reduce((s, l) => s + l.valor, 0);

  return {
    titulo,
    quinzena,
    linhas,
    vigente,
    fechamento,
    em_atraso,
    total,
    total_fechamento,
    total_atraso,
  };
}

/** Aba Faturar — tabela mensal cronológica. */
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

export function filterFaturamentoPorMes(
  meses: FaturamentoMes[],
  mes: string,
): FaturamentoMes[] {
  const raw = mes.trim();
  if (raw.toUpperCase() === "TOTAL") {
    // Financeiro Desconexão foca AGO+
    return meses.filter((row) => {
      const u = row.mes.toLowerCase();
      return (
        u.includes("agosto") ||
        u.includes("setembro") ||
        u.includes("outubro") ||
        u.includes("novembro") ||
        u.includes("dezembro") ||
        row.periodo.toUpperCase().includes("AGO")
      );
    });
  }
  const names: Record<number, string[]> = {
    1: ["janeiro"],
    2: ["fevereiro"],
    3: ["março", "marco"],
    4: ["abril"],
    5: ["maio"],
    6: ["junho"],
    7: ["julho"],
    8: ["agosto"],
    9: ["setembro"],
    10: ["outubro"],
    11: ["novembro"],
    12: ["dezembro"],
  };
  // Ano inteiro YYYY
  if (/^\d{4}$/.test(raw)) {
    return meses.filter((row) => row.mes.toLowerCase().includes(raw));
  }
  const [y, m] = raw.split("-");
  const mi = Number(m);
  const labels = names[mi] || [];
  return meses.filter((row) => {
    const u = row.mes.toLowerCase();
    if (!u.includes(y)) return false;
    return labels.some((label) => u.includes(label));
  });
}

export type HistoricoRecolhasMes = {
  mes_ym: string;
  label: string;
  linhas: APagarLinha[];
  recolhas: number;
  valor: number;
  pagas: number;
  nao_pagas: number;
  pago_valor: number;
  aberto_valor: number;
};

export type HistoricoRecolhasParse = {
  titulo: string;
  meses: HistoricoRecolhasMes[];
  total: {
    recolhas: number;
    valor: number;
    pagas: number;
    nao_pagas: number;
    pago_valor: number;
    aberto_valor: number;
  } | null;
};

const MES_NOME_TO_NUM: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function foldTxt(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** «novembro/2026» → 2026-11 */
export function mesLabelToYm(label: string): string | null {
  const t = String(label || "").trim().toLowerCase();
  const m = t.match(
    /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/?\s*(\d{4})/i,
  );
  if (!m) return null;
  const mi = MES_NOME_TO_NUM[m[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()] ||
    MES_NOME_TO_NUM[m[1].toLowerCase()];
  const y = Number(m[2]);
  if (!mi || !y) return null;
  return `${y}-${mi < 10 ? `0${mi}` : mi}`;
}

/** Valter corte / 01–15 → 1ª; aberto / 16–fim → 2ª. */
export function periodoToQuinzena(periodo: string): 1 | 2 {
  const u = foldTxt(periodo);
  if (u.includes("ABERTO")) return 2;
  if (/(^|[^\d])16\s*[\/–-]/.test(periodo) || u.startsWith("16/") || u.startsWith("16–") || u.startsWith("16-"))
    return 2;
  if (u.includes("16/10") || u.includes("16/09") || u.includes("16/11") || u.includes("16/12"))
    return 2;
  return 1;
}

/**
 * Aba HISTÓRICO RECOLHAS (DES / GOOGLE_SHEETS_ID) — só espelho.
 * Colunas: Período | Técnico | Classificação | Recolhas | Unitário | Valor | Pagas | Não pagas | Status.
 */
export function parseHistoricoRecolhas(rows: unknown[][]): HistoricoRecolhasParse {
  const titulo = cell(rows[0], 0) || "HISTÓRICO RECOLHAS";
  const meses: HistoricoRecolhasMes[] = [];
  let cur: HistoricoRecolhasMes | null = null;
  let total: HistoricoRecolhasParse["total"] = null;

  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0);
    if (!a) continue;
    const u = foldTxt(a);

    if (u.startsWith("TOTAL DESDE") || u === "TOTAL" || u.startsWith("TOTAL ")) {
      total = {
        recolhas: qty(rows[i]?.[3]),
        valor: money(rows[i]?.[5]),
        pagas: qty(rows[i]?.[6]),
        nao_pagas: qty(rows[i]?.[7]),
        pago_valor: 0,
        aberto_valor: 0,
      };
      const st = cell(rows[i], 8);
      const pagoM = st.match(/Pago\s*R\$\s*([\d.,]+)/i);
      const abM = st.match(/Em aberto\s*R\$\s*([\d.,]+)/i);
      if (pagoM) total.pago_valor = moneyLoose(pagoM[1]);
      if (abM) total.aberto_valor = moneyLoose(abM[1]);
      continue;
    }

    if (u.startsWith("SUBTOTAL")) {
      if (cur) {
        cur.recolhas = qty(rows[i]?.[3]) || cur.recolhas;
        cur.valor = money(rows[i]?.[5]) || cur.valor;
        cur.pagas = qty(rows[i]?.[6]) || cur.pagas;
        cur.nao_pagas = qty(rows[i]?.[7]) || cur.nao_pagas;
        const st = cell(rows[i], 8);
        const pagoM = st.match(/Pago\s*R\$\s*([\d.,]+)/i);
        const abM = st.match(/Em aberto\s*R\$\s*([\d.,]+)/i);
        if (pagoM) cur.pago_valor = moneyLoose(pagoM[1]);
        if (abM) cur.aberto_valor = moneyLoose(abM[1]);
      }
      continue;
    }

    const ym = mesLabelToYm(a);
    if (ym && !u.startsWith("PERIODO") && !u.startsWith("TECNICO")) {
      cur = {
        mes_ym: ym,
        label: a,
        linhas: [],
        recolhas: 0,
        valor: 0,
        pagas: 0,
        nao_pagas: 0,
        pago_valor: 0,
        aberto_valor: 0,
      };
      meses.push(cur);
      continue;
    }

    if (u.startsWith("PERIODO") && foldTxt(cell(rows[i], 1)).startsWith("TECNICO")) {
      continue; // header
    }
    if (!cur) continue;
    if (u.startsWith("PERIODO")) continue;

    const tecnico = cell(rows[i], 1);
    if (!tecnico) continue;
    const periodo = a;
    const classificacao = cell(rows[i], 2);
    const volume = qty(rows[i]?.[3]);
    const unitario = money(rows[i]?.[4]);
    const valor = money(rows[i]?.[5]);
    const pagas = qty(rows[i]?.[6]);
    const nao_pagas = qty(rows[i]?.[7]);
    const status = cell(rows[i], 8);
    cur.linhas.push({
      tecnico,
      volume,
      unitario,
      valor,
      status,
      periodo,
      bloco: "historico",
      classificacao,
      pagas,
      nao_pagas,
      mes_ym: cur.mes_ym,
    });
    cur.recolhas += volume;
    cur.valor += valor;
    cur.pagas += pagas;
    cur.nao_pagas += nao_pagas;
  }

  // Se subtotal não trouxe pago/aberto, deriva de linhas
  for (const m of meses) {
    if (!m.pago_valor && !m.aberto_valor) {
      let pago = 0;
      let aberto = 0;
      for (const l of m.linhas) {
        const st = foldTxt(l.status);
        if (st === "PAGO" || st.includes("PAGO TUDO")) {
          pago += l.valor;
        } else if (st.includes("EM ABERTO") || st.includes("A PAGAR")) {
          aberto += l.valor;
        } else if (st.includes("PARCIAL")) {
          const nao = l.nao_pagas ?? 0;
          const ab = Math.round(nao * l.unitario * 100) / 100;
          aberto += ab;
          pago += Math.round((l.valor - ab) * 100) / 100;
        } else {
          const nao = l.nao_pagas ?? 0;
          if (nao > 0) {
            const ab = Math.round(nao * l.unitario * 100) / 100;
            aberto += ab;
            pago += Math.round((l.valor - ab) * 100) / 100;
          } else {
            pago += l.valor;
          }
        }
      }
      m.pago_valor = Math.round(pago * 100) / 100;
      m.aberto_valor = Math.round(aberto * 100) / 100;
    }
  }

  return { titulo, meses, total };
}

/**
 * Espelho HISTÓRICO → APagarParse para quinzenas + bloco em aberto.
 * mes: YYYY-MM ou TOTAL (desde 01/09 na aba).
 */
export function historicoToAPagarParse(
  hist: HistoricoRecolhasParse,
  mes: string,
): APagarParse {
  const raw = mes.trim().toUpperCase();
  const meses =
    raw === "TOTAL"
      ? hist.meses.filter((m) => m.mes_ym >= "2026-09")
      : hist.meses.filter((m) => m.mes_ym === mes.trim());

  const fechamento: APagarLinha[] = [];
  const vigente: APagarLinha[] = [];
  /** Pendentes do bloco «em aberto»: EM ABERTO/A PAGAR + fatia não paga de PARCIAL. */
  const em_atraso: APagarLinha[] = [];

  for (const bloco of meses) {
    for (const l of bloco.linhas) {
      const q = periodoToQuinzena(l.periodo || "");
      const st = foldTxt(l.status);
      if (q === 2) {
        vigente.push({ ...l, bloco: "vigente" });
      } else {
        fechamento.push({ ...l, bloco: "fechamento" });
      }
      if (st.includes("EM ABERTO") || st.includes("A PAGAR")) {
        em_atraso.push({ ...l, bloco: "em_atraso" });
      } else {
        const nao = l.nao_pagas ?? 0;
        if (nao > 0) {
          const abValor = Math.round(nao * l.unitario * 100) / 100;
          em_atraso.push({
            ...l,
            volume: nao,
            valor: abValor,
            status: st.includes("PARCIAL")
              ? "PARCIAL · não pagas"
              : `${l.status} · não pagas`,
            bloco: "em_atraso",
          });
        }
      }
    }
  }

  const abertoSum = em_atraso.reduce((s, l) => s + l.valor, 0);
  const temQ2 = vigente.length > 0;
  const fechadosTodos = [...fechamento, ...vigente].filter((l) => {
    const st = foldTxt(l.status);
    return (
      st === "PAGO" ||
      st.includes("PAGO TUDO") ||
      st.includes("PARCIAL")
    );
  });

  return {
    titulo: hist.titulo,
    quinzena: temQ2 ? 2 : 1,
    linhas: em_atraso,
    vigente,
    // fechamento na quinzena = Q1; para bloco UI «fechado/pago» reusa fechamento+Q2 pagos via flag
    fechamento: fechamento.length ? fechamento : fechadosTodos,
    em_atraso,
    total: Math.round(abertoSum * 100) / 100,
    total_fechamento: fechadosTodos.reduce((s, l) => s + l.valor, 0),
    total_atraso: Math.round(abertoSum * 100) / 100,
  };
}
