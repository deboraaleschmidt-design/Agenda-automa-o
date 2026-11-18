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
  if (mes.trim().toUpperCase() === "TOTAL") {
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
  const [y, m] = mes.split("-");
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
  const mi = Number(m);
  const labels = names[mi] || [];
  return meses.filter((row) => {
    const u = row.mes.toLowerCase();
    if (!u.includes(y)) return false;
    return labels.some((label) => u.includes(label));
  });
}
