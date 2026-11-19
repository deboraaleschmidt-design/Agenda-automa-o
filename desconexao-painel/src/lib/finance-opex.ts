/**
 * Prévia OPEX + pagamento por quinzena (pedido 17/11/2026).
 * Só leitura; lacunas = sem preço / NÃO INFORMADO — sem inventar zeros.
 */
import type { APagarLinha, APagarParse } from "./finance-parse";
import { pagamentoQuinzenaMes, type NeutraReg } from "./neutra-engine";
import type { IatReg } from "./iat-base-engine";
import type { EquipeRow } from "./iat-parse";
import {
  CLT_SALARIO_PROVISORIO,
  PJ_RATE_ATIVIDADE,
} from "./types";

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

export type FinanceOpexPayload = {
  quinzenas: QuinzenaBloco[];
  mensal: {
    titulo: string;
    total_pago: number;
    linhas: QuinzenaPagLinha[];
  };
  opex: OpexBloco;
};

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

function isCltTipo(tipo: string, nome: string): boolean {
  const t = fold(tipo);
  if (t.includes("CLT")) return true;
  if (t.includes("PJ")) return false;
  const n = fold(nome);
  // Neutra CLTs nomeados + Desconexão Guilherme
  if (n.includes("LUIS GUSTAVO") && n.includes("LOPES")) return true;
  if (n.includes("VANIO") && n.includes("GONCALVES")) return true;
  if (n.includes("MARCIO") && n.includes("ARAUJO") && n.includes("DIAS"))
    return true;
  if (n.includes("GUILHERME") && n.includes("BECKER")) return true;
  return false;
}

function isAlexandre(nome: string): boolean {
  const n = fold(nome);
  return n.includes("ALEXANDRE") && n.includes("FRAGA");
}

function isValter(nome: string): boolean {
  const n = fold(nome);
  return n.includes("VALTER") || n === "SMA";
}

function moneyRound(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Contagem produtiva IAT por técnico × dia (último contrato). */
function iatProdByTechDay(
  regs: IatReg[],
  eq: EquipeRow[],
  y: number,
  m: number,
): Map<string, { nome: string; tipo: string; days: Map<number, number> }> {
  const byLogin = new Map(eq.map((e) => [fold(e.login), e]));
  const ultimo: Record<
    string,
    { nome: string; tipo: string; dia: number; ok: boolean }
  > = {};
  for (const r of regs) {
    if (r.dt.y !== y || r.dt.m !== m) continue;
    if (!r.contrato) continue;
    // status já vem folded em parseBaseIatRegs
    if (r.status !== "CONCLUIDO") continue;
    if (r.tipo.indexOf("NA BASE") === 0 || r.tipo.indexOf("REFEI") === 0)
      continue;
    const login = fold(r.login) || fold(r.quem);
    const e = byLogin.get(login);
    const nome = e?.nome || r.quem || login || "TCI";
    const tipo = e?.tipo || "";
    const setor = fold(e?.setor || "");
    if (setor.includes("DESCONEX") && !setor.includes("IAT")) continue;
    ultimo[r.contrato] = {
      nome,
      tipo,
      dia: r.dt.d,
      ok: r.codes.some((c) => c.code === 409),
    };
  }
  const out = new Map<
    string,
    { nome: string; tipo: string; days: Map<number, number> }
  >();
  for (const u of Object.values(ultimo)) {
    if (!u.ok) continue;
    const key = fold(u.nome);
    let cur = out.get(key);
    if (!cur) {
      cur = { nome: u.nome, tipo: u.tipo, days: new Map() };
      out.set(key, cur);
    }
    cur.days.set(u.dia, (cur.days.get(u.dia) || 0) + 1);
  }
  return out;
}

function sumDays(
  days: Map<number, number>,
  from: number,
  to: number,
): number {
  let s = 0;
  for (const [d, n] of days) {
    if (d >= from && d <= to) s += n;
  }
  return s;
}

/** Neutra com tipo da EQUIPE. */
export function enrichNeutraQuinzena(
  regs: NeutraReg[],
  equipeByTt: Map<string, { nome: string; tipo: string }>,
  y: number,
  m: number,
): { q1: QuinzenaPagLinha[]; q2: QuinzenaPagLinha[] } {
  const q1 = new Map<string, QuinzenaPagLinha>();
  const q2 = new Map<string, QuinzenaPagLinha>();
  const bump = (
    map: Map<string, QuinzenaPagLinha>,
    nome: string,
    tipo: string,
  ) => {
    const k = fold(nome);
    let cur = map.get(k);
    if (!cur) {
      const clt = isCltTipo(tipo, nome);
      cur = {
        tecnico: nome,
        tipo: clt ? "CLT" : "PJ",
        atividades: 0,
        valor: clt ? null : 0,
        nota: clt
          ? `CLT · salário mensal R$ ${CLT_SALARIO_PROVISORIO.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : `PJ · R$ ${PJ_RATE_ATIVIDADE}/atividade`,
      };
      map.set(k, cur);
    }
    cur.atividades += 1;
    if (cur.tipo === "PJ") {
      cur.valor = moneyRound((cur.valor || 0) + PJ_RATE_ATIVIDADE);
    }
  };
  for (const r of regs) {
    if (r.dt.y !== y || r.dt.m !== m) continue;
    if (r.estado !== "produtiva") continue;
    const eq = equipeByTt.get(r.tt);
    const nome = eq?.nome || r.nome;
    const tipo = eq?.tipo || "";
    bump(r.dt.d <= 15 ? q1 : q2, nome, tipo);
  }
  const sort = (a: QuinzenaPagLinha, b: QuinzenaPagLinha) =>
    (b.valor || 0) - (a.valor || 0) || a.tecnico.localeCompare(b.tecnico);
  return {
    q1: [...q1.values()].sort(sort),
    q2: [...q2.values()].sort(sort),
  };
}

export function buildIatQuinzena(
  regs: IatReg[],
  eq: EquipeRow[],
  y: number,
  m: number,
): { q1: QuinzenaPagLinha[]; q2: QuinzenaPagLinha[] } {
  const byTech = iatProdByTechDay(regs, eq, y, m);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const q1: QuinzenaPagLinha[] = [];
  const q2: QuinzenaPagLinha[] = [];
  for (const t of byTech.values()) {
    const clt = isCltTipo(t.tipo, t.nome);
    const a1 = sumDays(t.days, 1, 15);
    const a2 = sumDays(t.days, 16, last);
    if (a1 > 0) {
      q1.push({
        tecnico: t.nome,
        tipo: clt ? "CLT" : "PJ",
        atividades: a1,
        valor: clt ? null : moneyRound(a1 * PJ_RATE_ATIVIDADE),
        nota: clt
          ? `CLT · R$ ${CLT_SALARIO_PROVISORIO.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`
          : `PJ · R$ ${PJ_RATE_ATIVIDADE}/OS produtiva (409)`,
      });
    }
    if (a2 > 0) {
      q2.push({
        tecnico: t.nome,
        tipo: clt ? "CLT" : "PJ",
        atividades: a2,
        valor: clt ? null : moneyRound(a2 * PJ_RATE_ATIVIDADE),
        nota: clt
          ? `CLT · R$ ${CLT_SALARIO_PROVISORIO.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`
          : `PJ · R$ ${PJ_RATE_ATIVIDADE}/OS produtiva (409)`,
      });
    }
  }
  const sort = (a: QuinzenaPagLinha, b: QuinzenaPagLinha) =>
    (b.valor || 0) - (a.valor || 0) || a.tecnico.localeCompare(b.tecnico);
  return { q1: q1.sort(sort), q2: q2.sort(sort) };
}

function displayName(raw: string): string {
  const s = String(raw || "")
    .replace(/\bZ\d{5,}\b/gi, "")
    .replace(/\bSMA\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "TCI";
  const u = fold(s);
  if (u.includes("NAO IDENTIFICADO") || u.includes("OUTROS TCI") || u === "TCI")
    return "TCI";
  // Só nome (Title Case); sem matrícula/TT.
  return s
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function desconexaoLinha(
  l: APagarLinha,
  notaOverride?: string,
): QuinzenaPagLinha {
  const nome = displayName(l.tecnico);
  const periodo = l.periodo ? ` · ${l.periodo}` : "";
  if (isValter(l.tecnico)) {
    return {
      tecnico: nome,
      tipo: "parceiro",
      atividades: l.volume,
      valor: l.valor,
      nota:
        notaOverride ||
        `Parceiro · ${l.status || "A PAGAR"}${periodo}`,
    };
  }
  if (isAlexandre(l.tecnico)) {
    return {
      tecnico: nome,
      tipo: "sem_custo",
      atividades: l.volume,
      valor: 0,
      nota: "Login sem custo (produção na receita)",
    };
  }
  // Só Guilherme Becker (CLT Desconexão) — não Guilherme Mauricio (PJ no histórico).
  if (
    fold(l.tecnico).includes("GUILHERME") &&
    (fold(l.tecnico).includes("BECKER") || fold(l.tecnico).includes("SANTOS"))
  ) {
    return {
      tecnico: nome,
      tipo: "CLT",
      atividades: l.volume,
      valor: null,
      nota: `CLT · R$ ${CLT_SALARIO_PROVISORIO.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`,
    };
  }
  return {
    tecnico: nome,
    tipo: "PJ",
    atividades: l.volume,
    valor: l.valor,
    nota: notaOverride || `${l.status || "A PAGAR"}${periodo}`,
  };
}

/**
 * Desconexão: Valter = parceiro (A PAGAR); Guilherme CLT; Alexandre sem custo.
 * FECHAMENTO → 1ª; QUINZENA VIGENTE → 2ª quando a planilha marca Q2 (pós-corte).
 */
export function buildDesconexaoQuinzena(
  pack: APagarParse | APagarLinha[],
  y: number,
  m: number,
): { q1: QuinzenaPagLinha[]; q2: QuinzenaPagLinha[] } {
  void y;
  void m;
  const parsed: APagarParse = Array.isArray(pack)
    ? {
        titulo: "",
        quinzena: null,
        linhas: pack,
        vigente: [],
        fechamento: [],
        em_atraso: [],
        total: pack.reduce((s, l) => s + l.valor, 0),
        total_fechamento: 0,
        total_atraso: 0,
      }
    : pack;

  const q1: QuinzenaPagLinha[] = [];
  const q2: QuinzenaPagLinha[] = [];

  const multi =
    parsed.fechamento.length > 0 ||
    parsed.vigente.length > 0 ||
    parsed.em_atraso.length > 0;

  if (multi) {
    for (const l of parsed.fechamento) {
      q1.push(
        desconexaoLinha(
          l,
          `${l.status || "fechamento"}${l.periodo ? ` · ${l.periodo}` : ""}`,
        ),
      );
    }
    const destVigente = parsed.quinzena === 2 ? q2 : q1;
    for (const l of parsed.vigente) {
      destVigente.push(desconexaoLinha(l));
    }
    // Em atraso = saldo do fechamento ainda sem PAGO — não duplica valor na Q1
    // (já está no fechamento); só reforça nota se Valter parcial não listado.
    return { q1, q2 };
  }

  // Layout legado: um bloco → quinzena detectada no título, senão 1ª.
  const dest = parsed.quinzena === 2 ? q2 : q1;
  for (const l of parsed.linhas) {
    dest.push(desconexaoLinha(l));
  }
  return { q1, q2 };
}

function wrapQuinzenas(
  y: number,
  m: number,
  q1: QuinzenaPagLinha[],
  q2: QuinzenaPagLinha[],
): QuinzenaBloco[] {
  const pay = pagamentoQuinzenaMes(y, m);
  const tot = (linhas: QuinzenaPagLinha[]) =>
    moneyRound(
      linhas.reduce((s, l) => s + (l.valor != null && l.tipo !== "CLT" ? l.valor : 0), 0),
    );
  return [
    {
      id: "1a",
      titulo: "1ª quinzena",
      corte: `1–15/${pad(m)}/${y}`,
      pago_em: pay.q1_pago_em,
      linhas: q1,
      total: tot(q1),
    },
    {
      id: "2a",
      titulo: "2ª quinzena",
      corte: `16–fim/${pad(m)}/${y}`,
      pago_em: pay.q2_pago_em,
      linhas: q2,
      total: tot(q2),
    },
  ];
}

function buildOpex(
  receita: number,
  semPreco: number,
  quinzenas: QuinzenaBloco[],
  cltNomes: string[],
): OpexBloco {
  const linhas: OpexLinha[] = [];
  let custo_pj = 0;
  let custo_parceiro = 0;
  const seenClt = new Set<string>();

  for (const q of quinzenas) {
    for (const l of q.linhas) {
      if (l.tipo === "PJ" && l.valor != null) {
        custo_pj = moneyRound(custo_pj + l.valor);
        linhas.push({
          tecnico: l.tecnico,
          categoria: "PJ",
          detalhe: `${q.titulo} · ${l.atividades} × R$ ${PJ_RATE_ATIVIDADE}${
            (l.nota || "").includes("OS produtiva") ? "/OS" : ""
          }`,
          valor: l.valor,
        });
      } else if (l.tipo === "parceiro" && l.valor != null) {
        custo_parceiro = moneyRound(custo_parceiro + l.valor);
        linhas.push({
          tecnico: l.tecnico,
          categoria: "parceiro",
          detalhe: l.nota || "A PAGAR",
          valor: l.valor,
        });
      } else if (l.tipo === "CLT") {
        seenClt.add(fold(l.tecnico));
      } else if (l.tipo === "sem_custo") {
        linhas.push({
          tecnico: l.tecnico,
          categoria: "sem_custo",
          detalhe: l.nota || "sem custo",
          valor: 0,
        });
      }
    }
  }

  for (const nome of cltNomes) {
    const k = fold(nome);
    if (!k) continue;
    seenClt.add(k);
  }
  let custo_clt = 0;
  for (const k of seenClt) {
    // Nome legível: pega da lista ou da chave
    const nome =
      cltNomes.find((n) => fold(n) === k) ||
      quinzenas
        .flatMap((q) => q.linhas)
        .find((l) => fold(l.tecnico) === k)?.tecnico ||
      k;
    custo_clt = moneyRound(custo_clt + CLT_SALARIO_PROVISORIO);
    linhas.push({
      tecnico: nome,
      categoria: "CLT",
      detalhe: `Salário provisório · até 5º dia útil mês seguinte`,
      valor: CLT_SALARIO_PROVISORIO,
    });
  }

  const custo_total = moneyRound(custo_pj + custo_clt + custo_parceiro);
  const lucro = moneyRound(receita - custo_total);
  const margem = receita > 0 ? lucro / receita : null;

  return {
    receita,
    custo_pj,
    custo_clt,
    custo_parceiro,
    custo_total,
    lucro,
    margem,
    sem_preco: semPreco,
    linhas,
    salario_clt: CLT_SALARIO_PROVISORIO,
    rate_pj: PJ_RATE_ATIVIDADE,
  };
}

export function buildFinanceOpex(opts: {
  segmento: "desconexao" | "iat" | "neutra" | "todos";
  mes: string;
  receita: number;
  semPreco: number;
  aPagar: APagarLinha[] | APagarParse;
  iatRegs: IatReg[];
  iatEquipe: EquipeRow[];
  neutraRegs: NeutraReg[];
  neutraEquipeByTt: Map<string, { nome: string; tipo: string }>;
}): FinanceOpexPayload {
  const mesReq = opts.mes.trim().toUpperCase() === "TOTAL" ? "TOTAL" : opts.mes;
  // Quinzenas exigem mês concreto — em TOTAL usa o mês corrente dos dados (nov se houver).
  let y = 2026;
  let m = 11;
  if (mesReq !== "TOTAL") {
    const [ys, ms] = mesReq.split("-");
    y = Number(ys);
    m = Number(ms);
  } else {
    // último mês com dado
    for (const r of opts.neutraRegs) {
      if (r.dt.y > y || (r.dt.y === y && r.dt.m > m)) {
        y = r.dt.y;
        m = r.dt.m;
      }
    }
    for (const r of opts.iatRegs) {
      if (r.dt.y > y || (r.dt.y === y && r.dt.m > m)) {
        y = r.dt.y;
        m = r.dt.m;
      }
    }
  }

  let q1: QuinzenaPagLinha[] = [];
  let q2: QuinzenaPagLinha[] = [];
  const cltNomes: string[] = [];

  if (opts.segmento === "neutra" || opts.segmento === "todos") {
    const n = enrichNeutraQuinzena(
      opts.neutraRegs,
      opts.neutraEquipeByTt,
      y,
      m,
    );
    if (opts.segmento === "neutra") {
      q1 = n.q1;
      q2 = n.q2;
    } else {
      q1 = [...q1, ...n.q1.map((l) => ({ ...l, tecnico: `Neutra · ${l.tecnico}` }))];
      q2 = [...q2, ...n.q2.map((l) => ({ ...l, tecnico: `Neutra · ${l.tecnico}` }))];
    }
    for (const l of [...n.q1, ...n.q2]) {
      if (l.tipo === "CLT") cltNomes.push(l.tecnico);
    }
  }

  if (opts.segmento === "iat" || opts.segmento === "todos") {
    const i = buildIatQuinzena(opts.iatRegs, opts.iatEquipe, y, m);
    if (opts.segmento === "iat") {
      q1 = i.q1;
      q2 = i.q2;
    } else {
      q1 = [...q1, ...i.q1.map((l) => ({ ...l, tecnico: `IAT · ${l.tecnico}` }))];
      q2 = [...q2, ...i.q2.map((l) => ({ ...l, tecnico: `IAT · ${l.tecnico}` }))];
    }
    for (const l of [...i.q1, ...i.q2]) {
      if (l.tipo === "CLT") cltNomes.push(l.tecnico);
    }
  }

  if (opts.segmento === "desconexao" || opts.segmento === "todos") {
    const pack = Array.isArray(opts.aPagar)
      ? opts.aPagar
      : opts.aPagar;
    const d = buildDesconexaoQuinzena(pack, y, m);
    if (opts.segmento === "desconexao") {
      q1 = d.q1;
      q2 = d.q2;
    } else {
      q1 = [
        ...q1,
        ...d.q1.map((l) => ({ ...l, tecnico: `Desconexão · ${l.tecnico}` })),
      ];
      q2 = [
        ...q2,
        ...d.q2.map((l) => ({ ...l, tecnico: `Desconexão · ${l.tecnico}` })),
      ];
    }
    cltNomes.push("Guilherme Santos Becker");
  }

  const quinzenas = wrapQuinzenas(y, m, q1, q2);
  const mensalLinhas = [...q1, ...q2];
  // Mensal: PJ+parceiro das quinzenas + CLT salário (uma vez)
  const pjParc = moneyRound(
    mensalLinhas.reduce(
      (s, l) =>
        s +
        (l.tipo === "PJ" || l.tipo === "parceiro" ? l.valor || 0 : 0),
      0,
    ),
  );
  const cltUnique = [...new Set(cltNomes.map(fold))];
  const cltTotal = moneyRound(cltUnique.length * CLT_SALARIO_PROVISORIO);
  const opex = buildOpex(
    opts.receita,
    opts.semPreco,
    quinzenas,
    [...new Set(cltNomes)],
  );

  return {
    quinzenas,
    mensal: {
      titulo: `Visão mensal · ${pad(m)}/${y}`,
      total_pago: moneyRound(pjParc + cltTotal),
      linhas: [
        ...mensalLinhas.filter((l) => l.tipo === "PJ" || l.tipo === "parceiro"),
        ...[...new Set(cltNomes)].map((nome) => ({
          tecnico: nome,
          tipo: "CLT" as const,
          atividades: 0,
          valor: CLT_SALARIO_PROVISORIO,
          nota: "Salário mensal provisório",
        })),
      ],
    },
    opex,
  };
}

