import {
  emptyFinancePayload,
  filterFaturamentoPorMes,
  parseAPagar,
  parseFaturamento,
  type FinanceAtividade,
  type FinancePayload,
  type FinanceSegmento,
  type FinanceSubtotal,
} from "./finance-parse";
import {
  listMesesBase,
  parseBaseIatRegs,
  resolveMesRange,
  type IatReg,
} from "./iat-base-engine";
import { parseEquipe } from "./iat-parse";
import {
  matchLpuIat,
  menorPrecoDesconexao,
  parseLpuDesconexao,
  parseLpuIat,
  precoDesconexaoPorServico,
  type LpuItem,
} from "./lpu-parse";
import {
  findRespostasHeaderIndex,
  isMesOrTotal,
  rowMatchesMes,
  rowMonthKey,
} from "./painel-parse";
import { mapRespostasHeader, normalizeServico } from "./servico";
import { sheetsAuthOrNull } from "./sheets-client";
import {
  SPREADSHEET_D1_ID,
  SPREADSHEET_ID,
  SPREADSHEET_LPU_ID,
} from "./types";

function fold(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

function subtotalOf(lines: FinanceAtividade[], aPagar: number | null): FinanceSubtotal {
  return {
    servicos: lines.reduce((s, l) => s + l.quantidade, 0),
    valor_faturar: lines.reduce(
      (s, l) => s + (l.sem_preco || l.valor == null ? 0 : l.valor),
      0,
    ),
    sem_preco: lines.filter((l) => l.sem_preco).reduce((s, l) => s + l.quantidade, 0),
    a_pagar: aPagar,
  };
}

function normalizeSegmento(raw: string): FinanceSegmento {
  const u = raw.trim().toLowerCase();
  if (u === "desconexao" || u === "desconexão") return "desconexao";
  if (u === "iat") return "iat";
  return "todos";
}

function serialNorm(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function rowSortKey(map: ReturnType<typeof mapRespostasHeader>, row: unknown[]): string {
  const data = map.data >= 0 ? String(row[map.data] ?? "") : "";
  const ts = map.ts >= 0 ? String(row[map.ts] ?? "") : "";
  return `${data}|${ts}`;
}

/** Contagem Desconexão por tipo de serviço (Respostas) × preço LPU/VALORES. */
function buildDesconexaoAtividades(
  respostas: unknown[][],
  mes: string,
  lpu: LpuItem[],
): { lines: FinanceAtividade[]; avisos: string[] } {
  const avisos: string[] = [];
  const headerIdx = findRespostasHeaderIndex(respostas);
  if (headerIdx < 0) return { lines: [], avisos: ["Respostas sem cabeçalho."] };
  const map = mapRespostasHeader(respostas[headerIdx] || []);
  const menor = menorPrecoDesconexao(lpu);

  type Cand = {
    i: number;
    serial: string;
    servico: string;
    mk: { y: number; m: number } | null;
    sort: string;
  };
  const cands: Cand[] = [];
  let smartCard = 0;

  for (let i = headerIdx + 1; i < respostas.length; i++) {
    const row = respostas[i] || [];
    const serial = map.serial >= 0 ? serialNorm(row[map.serial]) : "";
    if (!serial) continue;
    const mk = rowMonthKey(map, row);
    if (!rowMatchesMes(mk, mes)) continue;
    // TOTAL Desconexão financeiro: desde ago/2026 (oficial)
    if (mes.trim().toUpperCase() === "TOTAL") {
      if (!mk || mk.y < 2026 || (mk.y === 2026 && mk.m < 8)) continue;
    }
    const servico = String(row[map.servico] ?? "").trim();
    if (fold(servico).includes("SMART")) {
      smartCard += 1;
      continue;
    }
    cands.push({
      i,
      serial,
      servico,
      mk,
      sort: rowSortKey(map, row),
    });
  }

  // Dedup a partir de 01/09/2026: mesmo serial + mesmo serviço → vale o último.
  cands.sort((a, b) =>
    a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : a.i - b.i,
  );
  const kept: Cand[] = [];
  const lastByKey = new Map<string, number>();
  let dropped = 0;
  for (const c of cands) {
    const afterSep =
      c.mk &&
      (c.mk.y > 2026 || (c.mk.y === 2026 && c.mk.m >= 9));
    if (afterSep) {
      const k = `${c.serial}|${fold(c.servico)}`;
      const prev = lastByKey.get(k);
      if (prev != null) {
        kept[prev] = c;
        dropped += 1;
        continue;
      }
      lastByKey.set(k, kept.length);
      kept.push(c);
    } else {
      kept.push(c);
    }
  }

  const buckets = new Map<
    string,
    { codigo: string; descricao: string; qtd: number; preco: number | null; sem: boolean }
  >();
  let desconhecido = 0;
  for (const c of kept) {
    const norm = normalizeServico(c.servico);
    const priced = precoDesconexaoPorServico(c.servico || norm, lpu, menor);
    if (norm === "OUTROS") desconhecido += 1;
    const key = `${priced.codigo}|${priced.descricao}|${priced.preco ?? "x"}`;
    const cur = buckets.get(key) || {
      codigo: priced.codigo,
      descricao: priced.descricao,
      qtd: 0,
      preco: priced.preco,
      sem: priced.sem_preco,
    };
    cur.qtd += 1;
    buckets.set(key, cur);
  }

  if (smartCard) {
    avisos.push(
      `Desconexão: ${smartCard} linha(s) SMART CARD ignoradas (nunca faturam/pagam).`,
    );
  }
  if (dropped) {
    avisos.push(
      `Desconexão: ${dropped} serial(is) duplicado(s) desconsiderado(s) (mesmo serviço · mantido o último ≥01/09).`,
    );
  }
  if (desconhecido) {
    avisos.push(
      `Desconexão: ${desconhecido} serviço(s) fora do mapa VALORES → preço padrão retirada LPU.`,
    );
  }

  const lines: FinanceAtividade[] = [...buckets.values()]
    .map((b) => ({
      segmento: "desconexao" as const,
      codigo: b.codigo,
      descricao: b.descricao,
      quantidade: b.qtd,
      preco_unitario: b.preco,
      valor: b.sem || b.preco == null ? null : Math.round(b.qtd * b.preco * 100) / 100,
      sem_preco: b.sem,
      origem_lpu: "LPU · aba CLARO DESCONEXÃO (+ regras VALORES)",
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return { lines, avisos };
}

function soDesconexaoEquipe(setor: string): boolean {
  const s = fold(setor);
  return s.includes("DESCONEX") && !s.includes("IAT");
}

/** IAT: OS executadas em contratos produtivos (409), desde 01/10/2026. */
function buildIatAtividades(
  regs: IatReg[],
  equipeRows: unknown[][],
  mes: string,
  lpu: LpuItem[],
): {
  lines: FinanceAtividade[];
  avisos: string[];
  meses: string[];
  gabrielNota: string;
} {
  const avisos: string[] = [];
  const eqList = parseEquipe(equipeRows);
  const eqMap: Record<
    string,
    { login: string; nome: string; base: string; setor: string; tipo: string }
  > = {};
  for (const e of eqList) {
    const login = fold(e.login);
    if (!login) continue;
    eqMap[login] = { ...e, login };
  }

  const gabriel = eqList.find((e) => fold(e.nome).includes("GABRIEL"));
  const gabrielNota = gabriel
    ? `Gabriel (${gabriel.login}): EQUIPE ainda marca ${gabriel.tipo || "—"}; regra Debora: PJ desde 12/11/2026.`
    : "Gabriel: não encontrado na EQUIPE.";

  const meses = listMesesBase(regs);
  const maxKey = regs.reduce((m, r) => (r.dt.key > m ? r.dt.key : m), "2026-10-01");
  const range = resolveMesRange(mes, maxKey);

  // Último registro válido por contrato no período
  const ultimo: Record<string, IatReg> = {};
  for (const r of regs) {
    if (r.dt.key < range.start || r.dt.key > range.end) continue;
    if (r.status !== "CONCLUIDO") continue;
    if (r.tipo.indexOf("NA BASE") === 0 || r.tipo.indexOf("REFEI") === 0) continue;
    if (!r.contrato) continue;
    const p = eqMap[r.login] || eqMap[r.quem];
    if (!p || soDesconexaoEquipe(p.setor)) continue;
    if (!r.codes.some((c) => c.code === 409)) continue;
    ultimo[r.contrato] = r;
  }

  const buckets = new Map<
    string,
    {
      codigo: string;
      descricao: string;
      qtd: number;
      preco: number | null;
      sem: boolean;
    }
  >();
  let semMatch = 0;
  let ambig = 0;

  for (const r of Object.values(ultimo)) {
    const oss = r.osRaw.length ? r.osRaw : [];
    if (!oss.length) {
      semMatch += 1;
      const key = "sem-os|Sem Tipo O.S|x";
      const cur = buckets.get(key) || {
        codigo: "—",
        descricao: "Sem Tipo O.S na BASE",
        qtd: 0,
        preco: null,
        sem: true,
      };
      cur.qtd += 1;
      buckets.set(key, cur);
      continue;
    }
    for (const os of oss) {
      const { item, ambiguous } = matchLpuIat(os, lpu, r.comp);
      if (ambiguous) ambig += 1;
      if (!item) {
        semMatch += 1;
        const m = String(os).match(/^\s*([\d.,]+)\s*[-–—]?\s*(.*)$/);
        const codigo = (m?.[1] || "—").trim();
        const desc = ((m?.[2] || os).trim() || os) + (ambiguous ? " (ambíguo LPU)" : "");
        const key = `${codigo}|${desc}|x`;
        const cur = buckets.get(key) || {
          codigo,
          descricao: desc,
          qtd: 0,
          preco: null,
          sem: true,
        };
        cur.qtd += 1;
        buckets.set(key, cur);
        continue;
      }
      const sem = item.preco == null;
      if (sem) semMatch += 1;
      const key = `${item.codigo}|${item.descricao}|${item.preco ?? "x"}`;
      const cur = buckets.get(key) || {
        codigo: item.codigo,
        descricao: item.descricao,
        qtd: 0,
        preco: item.preco,
        sem,
      };
      cur.qtd += 1;
      buckets.set(key, cur);
    }
  }

  if (semMatch) {
    avisos.push(
      `IAT: ${semMatch} serviço(s) sem preço LPU casado (exibidos como «sem preço»).`,
    );
  }
  if (ambig) {
    avisos.push(
      `IAT: ${ambig} casamento(s) LPU ambíguo(s) → «sem preço» (não assumido).`,
    );
  }

  const lines: FinanceAtividade[] = [...buckets.values()]
    .map((b) => ({
      segmento: "iat" as const,
      codigo: b.codigo,
      descricao: b.descricao,
      quantidade: b.qtd,
      preco_unitario: b.preco,
      valor: b.sem || b.preco == null ? null : Math.round(b.qtd * b.preco * 100) / 100,
      sem_preco: b.sem,
      origem_lpu: "LPU · aba CLARO IAT (casamento por descrição Tipo O.S)",
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return { lines, avisos, meses, gabrielNota };
}

/** Meses disponíveis = Desconexão (FATURAR AGO+) ∪ IAT (BASE ≥ 01/10). */
function mergeMeses(
  fatMeses: { mes: string }[],
  iatMeses: string[],
): string[] {
  const set = new Set<string>(iatMeses);
  const names: Record<string, number> = {
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
  for (const row of fatMeses) {
    const u = row.mes.toLowerCase();
    const ys = u.match(/20\d{2}/);
    if (!ys) continue;
    let m = 0;
    for (const [k, v] of Object.entries(names)) {
      if (u.includes(k)) {
        m = v;
        break;
      }
    }
    if (!m) continue;
    // Desconexão oficial desde ago/2026 no financeiro
    const ym = `${ys[0]}-${pad(m)}`;
    if (ym >= "2026-08") set.add(ym);
  }
  return [...set].sort();
}

export async function syncFinanceiro(opts?: {
  mes?: string;
  segmento?: string;
}): Promise<FinancePayload> {
  const mes = opts?.mes?.trim() || "TOTAL";
  const segmento = normalizeSegmento(opts?.segmento || "todos");
  if (!isMesOrTotal(mes) && mes.toUpperCase() !== "TOTAL") {
    return emptyFinancePayload(mes, segmento, "Mês inválido. Use YYYY-MM ou TOTAL.");
  }

  const auth = sheetsAuthOrNull();
  if (!auth.ok) {
    return emptyFinancePayload(
      mes,
      segmento,
      auth.reason || "Credencial Sheets indisponível.",
    );
  }

  try {
    const [desRes, d1Res, lpuRes] = await Promise.all([
      auth.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges: [
          "'PAINEL RECOLHAS'!A1:E40",
          "'FATURAR CLARO'!A1:E40",
          "'Respostas ao formulário 1'!A1:S",
        ],
        valueRenderOption: "FORMATTED_VALUE",
      }),
      auth.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_D1_ID,
        ranges: ["'BASE IAT'!A1:DO", "EQUIPE!A1:F40"],
        valueRenderOption: "FORMATTED_VALUE",
      }),
      auth.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_LPU_ID,
        ranges: ["'CLARO DESCONEXÃO'!A1:E40", "'CLARO IAT'!A1:G220"],
        valueRenderOption: "FORMATTED_VALUE",
      }),
    ]);

    const desRanges = desRes.data.valueRanges || [];
    const recolhas = desRanges[0]?.values || [];
    const faturar = desRanges[1]?.values || [];
    const respostas = desRanges[2]?.values || [];

    const d1Ranges = d1Res.data.valueRanges || [];
    const baseRows = d1Ranges[0]?.values || [];
    const eqRows = d1Ranges[1]?.values || [];

    const lpuRanges = lpuRes.data.valueRanges || [];
    const lpuDes = parseLpuDesconexao(lpuRanges[0]?.values || []);
    const lpuIat = parseLpuIat(lpuRanges[1]?.values || []);

    const pagar = parseAPagar(recolhas);
    const fat = parseFaturamento(faturar);
    const fatFiltrado = filterFaturamentoPorMes(fat.meses, mes);

    const des = buildDesconexaoAtividades(respostas, mes, lpuDes);
    const { regs } = parseBaseIatRegs(baseRows);
    const iat = buildIatAtividades(regs, eqRows, mes, lpuIat.items);

    const showDes = segmento === "desconexao" || segmento === "todos";
    const showIat = segmento === "iat" || segmento === "todos";
    const atividades = [
      ...(showDes ? des.lines : []),
      ...(showIat ? iat.lines : []),
    ];

    const subDes = subtotalOf(des.lines, pagar.total);
    const subIat = subtotalOf(iat.lines, null);
    const subGeral = subtotalOf(
      [...(showDes ? des.lines : []), ...(showIat ? iat.lines : [])],
      showDes ? pagar.total : null,
    );

    const fatCheck = filterFaturamentoPorMes(fat.meses, mes);
    const fatSum =
      mes.toUpperCase() === "TOTAL"
        ? fat.agoMais.valor
        : fatCheck.reduce((s, m) => s + m.faturamento, 0);
    const fatQty =
      mes.toUpperCase() === "TOTAL"
        ? fat.agoMais.recolhas
        : fatCheck.reduce((s, m) => s + m.recolhas, 0);
    const fatAviso =
      showDes && fatQty > 0
        ? `Conferência FATURAR CLARO (${mes}): ${fatQty} recolhas · ${fatSum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · LPU Respostas: ${subDes.servicos} · ${subDes.valor_faturar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        : "";

    const duvidas = [
      ...des.avisos,
      ...iat.avisos,
      ...(fatAviso ? [fatAviso] : []),
      "Pagamento a técnico IAT: NÃO INFORMADO — não inventado.",
      iat.gabrielNota,
    ];

    const meses_disponiveis = mergeMeses(fat.meses, iat.meses);

    return {
      atualizado_em: new Date().toISOString(),
      fonte: "sheets",
      status: "ok",
      mensagem: `Financeiro · ${segmento} · ${mes}`,
      mes,
      segmento,
      meses_disponiveis,
      lpu_origem: {
        desconexao: "LPU GERAL TCI · aba CLARO DESCONEXÃO (preço bruto c/ impostos)",
        iat: `LPU GERAL TCI · aba CLARO IAT${
          lpuIat.valorHora != null
            ? ` · VALOR HS R$ ${lpuIat.valorHora.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : ""
        }`,
        valor_hora_iat: lpuIat.valorHora,
      },
      atividades,
      subtotais: {
        desconexao: subDes,
        iat: subIat,
        geral: subGeral,
      },
      quinzena_titulo: pagar.titulo,
      a_pagar: showDes ? pagar.linhas : [],
      total_a_pagar: showDes ? pagar.total : 0,
      a_pagar_iat_nota:
        "IAT: sem tabela de pagamento a técnico na planilha — só faturamento LPU.",
      faturamento_meses: fatFiltrado.length ? fatFiltrado : fat.meses,
      faturamento_ago_mais: fat.agoMais,
      duvidas,
      gabriel_nota: iat.gabrielNota,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return emptyFinancePayload(
      mes,
      segmento,
      `Falha ao ler financeiro/LPU/IAT: ${msg}`,
    );
  }
}
