/**
 * Contagens Neutra a partir de BASE NEUTRA + EQUIPE NEUTRA (só leitura).
 * Regras: pedido 17/11/2026 + aba NEUTRA (validação).
 */
import {
  formatTempoMedio,
  type NeutraEquipeRow,
  type NeutraPayload,
  type NeutraResumo,
  type NeutraTechRow,
} from "./neutra-parse";

const PRECO_COM_DROP = 150;
const PRECO_SEM_DROP = 170;
const PRECO_RETIRADA = 96.23;
const PRECO_MESH = 49.8;
const MAX_TEMPO_MIN = 12 * 60;

export type NeutraDate = { d: number; m: number; y: number; key: string };

export type NeutraReg = {
  sa: string;
  dt: NeutraDate;
  estado: "produtiva" | "improdutiva";
  macro: string;
  drop: boolean;
  meshEquip: number;
  tt: string;
  nome: string;
  area: string;
  tempoMin: number | null;
  i: number;
};

function fold(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function txt(v: unknown): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

function parseDateOnly(v: unknown): NeutraDate | null {
  let d: number;
  let m: number;
  let y: number;
  if (typeof v === "number" && v > 30000 && v < 80000) {
    const dt = new Date(Math.round((v - 25569) * 86400000));
    d = dt.getUTCDate();
    m = dt.getUTCMonth() + 1;
    y = dt.getUTCFullYear();
  } else {
    const s = txt(v);
    let a = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (a) {
      d = Number(a[1]);
      m = Number(a[2]);
      y = Number(a[3]);
    } else {
      const b = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!b) return null;
      y = Number(b[1]);
      m = Number(b[2]);
      d = Number(b[3]);
    }
    if (y < 100) y += 2000;
  }
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 2000)) return null;
  return { d, m, y, key: `${y}-${pad(m)}-${pad(d)}` };
}

function parseDateTimeMs(v: unknown): number | null {
  if (typeof v === "number" && v > 30000 && v < 80000) {
    return Math.round((v - 25569) * 86400000);
  }
  const s = txt(v);
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dt = new Date(
      y,
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
    return dt.getTime();
  }
  const iso = s.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!iso) return null;
  const dt = new Date(
    Number(iso[1]),
    Number(iso[2]) - 1,
    Number(iso[3]),
    Number(iso[4] || 0),
    Number(iso[5] || 0),
    Number(iso[6] || 0),
  );
  return dt.getTime();
}

function isDrop(v: unknown): boolean {
  const f = fold(v);
  return f === "VERDADEIRO" || f === "TRUE" || f === "SIM" || f === "1";
}

/** Extrai TT/TR do texto "NOME - TTxxxxxx". */
export function parseTechLogin(tecnico: unknown): string | null {
  const s = txt(tecnico);
  const m = s.match(/\b(TT|TR)\s*[-_]?\s*(\d{4,})\b/i);
  if (!m) return null;
  return fold(m[1] + m[2]);
}

/**
 * Match EQUIPE: TT depois TR (mesmo número).
 * Guilherme Becker = TT608600 (conta só o OK dele).
 */
export function matchEquipe(
  login: string | null,
  byTt: Map<string, NeutraEquipeRow>,
  byTr: Map<string, NeutraEquipeRow>,
): NeutraEquipeRow | null {
  if (!login) return null;
  const num = login.replace(/^(TT|TR)/, "");
  const ttKey = `TT${num}`;
  const trKey = `TR${num}`;
  if (byTt.has(ttKey)) return byTt.get(ttKey) || null;
  if (byTr.has(trKey)) return byTr.get(trKey) || null;
  return null;
}

function mapBaseCols(header: unknown[]) {
  const c: Record<string, number> = {};
  header.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    if (f.indexOf("NUMERO SA") === 0 || f === "NUMERO SA") c.sa = i;
    if (f.indexOf("INICIO EXECUCAO") === 0) c.inicio = i;
    if (f === "ESTADO") c.estado = i;
    if (f.indexOf("TECNICO ATRIBUIDO") === 0) c.tecnico = i;
    if (f === "MACRO ATIVIDADE") c.macro = i;
    if (f.indexOf("REAPROVEITAMENTO DE DROP") === 0) c.drop = i;
    if (f.indexOf("FIM EXECUCAO") === 0) c.fim = i;
    if (f.indexOf("TIPO DE TRABALHO") === 0) c.tipoTrab = i;
  });
  return c;
}

export function parseEquipeNeutra(rows: unknown[][]): NeutraEquipeRow[] {
  if (!rows.length) return [];
  const header = rows[0] || [];
  const idx = {
    nome: -1,
    tt: -1,
    tr: -1,
    tipo: -1,
    area: -1,
    situacao: -1,
    obs: -1,
  };
  header.forEach((h, i) => {
    const f = fold(h);
    if (f === "NOME") idx.nome = i;
    if (f === "TT") idx.tt = i;
    if (f === "TR") idx.tr = i;
    if (f === "TIPO") idx.tipo = i;
    if (f.indexOf("AREA") === 0 || f.indexOf("BASE") >= 0) idx.area = i;
    if (f.indexOf("SITUACAO") === 0) idx.situacao = i;
    if (f.indexOf("AVATAR") === 0 || f.indexOf("OBS") === 0) idx.obs = i;
  });
  const out: NeutraEquipeRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const nome = idx.nome >= 0 ? txt(row[idx.nome]) : "";
    const tt = idx.tt >= 0 ? fold(row[idx.tt]) : "";
    if (!nome && !tt) continue;
    out.push({
      nome,
      tt,
      tr: idx.tr >= 0 ? fold(row[idx.tr]) : "",
      tipo: idx.tipo >= 0 ? txt(row[idx.tipo]) : "",
      area: idx.area >= 0 ? txt(row[idx.area]) : "",
      situacao: idx.situacao >= 0 ? txt(row[idx.situacao]) : "",
      obs: idx.obs >= 0 ? txt(row[idx.obs]) : "",
    });
  }
  return out;
}

/** Mesh: 2 equipamentos = mesh; conta equipamentos mencionados na col. Tipo de trabalho. */
function parseMeshEquip(tipoTrab: unknown): number {
  const s = txt(tipoTrab);
  if (!s) return 0;
  const f = fold(s);
  if (!f.includes("MESH")) return 0;
  const nums = [...s.matchAll(/(\d+)\s*(?:equip|eqp|unid)/gi)].map((m) =>
    Number(m[1]),
  );
  if (nums.length) return nums.reduce((a, b) => a + b, 0);
  // "2" sozinho ou "mesh x2"
  const x = s.match(/(?:x|\*)\s*(\d+)/i) || s.match(/\b(\d+)\b/);
  if (x) return Number(x[1]);
  return 2; // menção a mesh sem qtd → 2 equip (pedido)
}

function tempoEntre(inicio: unknown, fim: unknown): number | null {
  const a = parseDateTimeMs(inicio);
  const b = parseDateTimeMs(fim);
  if (a == null || b == null) return null;
  const mins = (b - a) / 60000;
  if (!Number.isFinite(mins) || mins < 0 || mins >= MAX_TEMPO_MIN) return null;
  return mins;
}

function isInstMud(macro: string): boolean {
  return macro === "INST-FTTH" || macro === "MUD-FTTH";
}

function isRetirada(macro: string): boolean {
  return macro.indexOf("RET") === 0 || macro.includes("RETIRADA");
}

export function parseBaseNeutraRegs(
  baseRows: unknown[][],
  equipe: NeutraEquipeRow[],
): { regs: NeutraReg[]; avisos: string[] } {
  const avisos: string[] = [];
  if (!baseRows.length) return { regs: [], avisos: ["BASE NEUTRA vazia."] };
  const c = mapBaseCols(baseRows[0] || []);
  if (c.sa == null || c.estado == null || c.tecnico == null) {
    return { regs: [], avisos: ["BASE NEUTRA sem colunas esperadas."] };
  }

  const byTt = new Map<string, NeutraEquipeRow>();
  const byTr = new Map<string, NeutraEquipeRow>();
  for (const e of equipe) {
    if (e.tt) byTt.set(fold(e.tt), e);
    if (e.tr) byTr.set(fold(e.tr), e);
  }

  // 1 linha por Número SA (última ocorrência na base)
  const bySa = new Map<string, NeutraReg>();
  let meshVazio = true;

  for (let i = 1; i < baseRows.length; i++) {
    const row = baseRows[i] || [];
    if (!row.some((x) => x !== "" && x != null)) continue;
    const estadoRaw = fold(row[c.estado]);
    let estado: "produtiva" | "improdutiva" | null = null;
    if (estadoRaw === "CONCLUIDO COM SUCESSO") estado = "produtiva";
    else if (estadoRaw === "CONCLUIDO SEM SUCESSO") estado = "improdutiva";
    if (!estado) continue;

    const inicio = c.inicio != null ? row[c.inicio] : "";
    const fim = c.fim != null ? row[c.fim] : "";
    const dt = parseDateOnly(inicio) || parseDateOnly(fim);
    if (!dt) continue;

    const login = parseTechLogin(row[c.tecnico]);
    const eq = matchEquipe(login, byTt, byTr);
    if (!eq) continue;

    // Guilherme Becker = só TT608600
    if (
      fold(eq.nome).includes("GUILHERME") &&
      fold(eq.nome).includes("BECKER") &&
      fold(eq.tt) !== "TT608600"
    ) {
      continue;
    }

    const sa = fold(row[c.sa]);
    if (!sa) continue;
    const macro = c.macro != null ? fold(row[c.macro]) : "";
    const tipoTrab = c.tipoTrab != null ? row[c.tipoTrab] : "";
    if (txt(tipoTrab)) meshVazio = false;
    const meshEquip =
      estado === "produtiva" ? parseMeshEquip(tipoTrab) : 0;

    bySa.set(sa, {
      sa,
      dt,
      estado,
      macro,
      drop: c.drop != null ? isDrop(row[c.drop]) : false,
      meshEquip,
      tt: fold(eq.tt),
      nome: eq.nome, // só NOME da EQUIPE
      area: eq.area,
      tempoMin: tempoEntre(inicio, fim),
      i,
    });
  }

  if (meshVazio) {
    avisos.push(
      "Mesh ainda não disponível na base (col. Tipo de trabalho: Descrição vazia).",
    );
  }

  const regs = [...bySa.values()].sort((a, b) =>
    a.dt.key < b.dt.key ? -1 : a.dt.key > b.dt.key ? 1 : a.i - b.i,
  );
  return { regs, avisos };
}

export function listMesesNeutra(regs: NeutraReg[]): string[] {
  const set = new Set<string>();
  for (const r of regs) set.add(`${r.dt.y}-${pad(r.dt.m)}`);
  return [...set].sort();
}

function resolveRange(
  mes: string,
  maxKey: string,
): { start: string; end: string } {
  if (mes.trim().toUpperCase() === "TOTAL") {
    return { start: "2000-01-01", end: maxKey || "2099-12-31" };
  }
  const [ys, ms] = mes.trim().split("-");
  const y = Number(ys);
  const m = Number(ms);
  const start = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let end = `${y}-${pad(m)}-${pad(lastDay)}`;
  if (end > maxKey) end = maxKey;
  return { start, end };
}

/** Semana seg–dom (ISO-like: Monday start) a partir de y-m-d. */
function weekKey(dt: NeutraDate): string {
  const js = new Date(Date.UTC(dt.y, dt.m - 1, dt.d));
  const day = js.getUTCDay(); // 0=dom
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(js);
  mon.setUTCDate(js.getUTCDate() + mondayOffset);
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function valorReg(r: NeutraReg): number {
  if (r.estado !== "produtiva") return 0;
  let v = 0;
  if (isInstMud(r.macro)) {
    v += r.drop ? PRECO_COM_DROP : PRECO_SEM_DROP;
  } else if (isRetirada(r.macro)) {
    v += PRECO_RETIRADA;
  }
  // SRV e demais sem LPU casada → 0 aqui (linha "sem preço" no financeiro)
  if (r.meshEquip > 0) v += r.meshEquip * PRECO_MESH;
  return Math.round(v * 100) / 100;
}

export function buildNeutraFromBase(opts: {
  baseRows: unknown[][];
  equipeRows: unknown[][];
  mes?: string;
}): NeutraPayload {
  const mesReq = opts.mes?.trim() || "TOTAL";
  const equipe = parseEquipeNeutra(opts.equipeRows);
  const { regs: all, avisos } = parseBaseNeutraRegs(opts.baseRows, equipe);
  const meses = listMesesNeutra(all);
  const maxKey = all.reduce((m, r) => (r.dt.key > m ? r.dt.key : m), "");
  const range = resolveRange(mesReq, maxKey || "2099-12-31");
  const regs = all.filter(
    (r) => r.dt.key >= range.start && r.dt.key <= range.end,
  );

  const dadosAte = maxKey || null;
  let dadosAteBr: string | null = null;
  if (dadosAte) {
    const [y, m, d] = dadosAte.split("-");
    dadosAteBr = `${d}/${m}`;
    void y;
  }

  type Acc = {
    nome: string;
    tt: string;
    area: string;
    prod: number;
    improd: number;
    drop: number;
    tempos: number[];
    days: Set<string>;
    weeks: Set<string>;
    months: Set<string>;
    valor: number;
  };
  const per = new Map<string, Acc>();
  const diasAll = new Set<string>();
  const temposAll: number[] = [];
  let prod = 0;
  let improd = 0;
  let reaprov = 0;
  let instCom = 0;
  let instSem = 0;

  for (const r of regs) {
    diasAll.add(r.dt.key);
    if (r.tempoMin != null) temposAll.push(r.tempoMin);
    if (r.estado === "produtiva") {
      prod += 1;
      if (r.drop) reaprov += 1;
      if (isInstMud(r.macro)) {
        if (r.drop) instCom += 1;
        else instSem += 1;
      }
    } else {
      improd += 1;
    }

    const cur = per.get(r.tt) || {
      nome: r.nome,
      tt: r.tt,
      area: r.area,
      prod: 0,
      improd: 0,
      drop: 0,
      tempos: [],
      days: new Set<string>(),
      weeks: new Set<string>(),
      months: new Set<string>(),
      valor: 0,
    };
    cur.days.add(r.dt.key);
    cur.weeks.add(weekKey(r.dt));
    cur.months.add(`${r.dt.y}-${pad(r.dt.m)}`);
    if (r.tempoMin != null) cur.tempos.push(r.tempoMin);
    if (r.estado === "produtiva") {
      cur.prod += 1;
      if (r.drop) cur.drop += 1;
      cur.valor = Math.round((cur.valor + valorReg(r)) * 100) / 100;
    } else {
      cur.improd += 1;
    }
    per.set(r.tt, cur);
  }

  const tempoMed = avg(temposAll);
  const total = prod + improd;
  const resumo: NeutraResumo = {
    tecnicos: per.size,
    produtivas: prod,
    improdutivas: improd,
    pct_sucesso: total ? prod / total : 0,
    tempo_medio_min: tempoMed,
    tempo_medio_label: formatTempoMedio(
      tempoMed == null ? null : Math.round(tempoMed),
    ),
    reaprov_pct: prod ? reaprov / prod : 0,
    reaprov_qtd: reaprov,
    dias_atividade: diasAll.size,
    inst_mud_com_drop: instCom,
    inst_mud_sem_drop: instSem,
    valor_inst_mud:
      Math.round((instCom * PRECO_COM_DROP + instSem * PRECO_SEM_DROP) * 100) /
      100,
  };

  const tecnicos: NeutraTechRow[] = [...per.values()]
    .map((a) => {
      const dias = a.days.size || 1;
      const semanas = a.weeks.size || 1;
      const mesesN = a.months.size || 1;
      const tot = a.prod + a.improd;
      const tMed = avg(a.tempos);
      return {
        nome: a.nome,
        tt: a.tt,
        area: a.area,
        produtivas: a.prod,
        improdutivas: a.improd,
        pct_sucesso: tot ? a.prod / tot : 0,
        tempo_medio_min: tMed,
        tempo_medio_label: formatTempoMedio(
          tMed == null ? null : Math.round(tMed),
        ),
        reaprov_qtd: a.drop,
        reaprov_pct: a.prod ? a.drop / a.prod : 0,
        dias_trab: a.days.size,
        media_prod_dia: Math.round((a.prod / dias) * 10) / 10,
        media_pend_dia: Math.round((a.improd / dias) * 10) / 10,
        media_prod_semana: Math.round((a.prod / semanas) * 10) / 10,
        media_pend_semana: Math.round((a.improd / semanas) * 10) / 10,
        media_prod_mes: Math.round((a.prod / mesesN) * 10) / 10,
        media_pend_mes: Math.round((a.improd / mesesN) * 10) / 10,
        valor_ok_tci: a.valor,
      };
    })
    .filter((t) => t.produtivas + t.improdutivas > 0)
    .sort((a, b) => a.pct_sucesso - b.pct_sucesso || a.nome.localeCompare(b.nome));

  const mesLabel =
    mesReq.toUpperCase() === "TOTAL"
      ? "TOTAL"
      : (() => {
          const [y, m] = mesReq.split("-");
          return `${pad(Number(m))}/${y}`;
        })();

  return {
    atualizado_em: new Date().toISOString(),
    fonte: "sheets",
    status: "ok",
    titulo: `PAINEL PRODUÇÃO NEUTRA · ${mesLabel}`,
    dados_ate: dadosAte,
    dados_ate_br: dadosAteBr,
    meses_disponiveis: meses,
    mes: mesReq.toUpperCase() === "TOTAL" ? "TOTAL" : mesReq,
    resumo,
    tecnicos,
    avisos,
    equipe,
  };
}

export {
  PRECO_COM_DROP,
  PRECO_SEM_DROP,
  PRECO_RETIRADA,
  PRECO_MESH,
  isInstMud,
  isRetirada,
};
