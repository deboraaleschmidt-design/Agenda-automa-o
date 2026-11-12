/**
 * Contagens IAT / PAINEL OK / RETORNO a partir da BASE IAT (só leitura).
 * Regras = briefing §1.3 + notas das abas PAINEL OK / RETORNO CREDENCIADA.
 */
import {
  parseEquipe,
  type EquipeRow,
  type IatBlock,
  type IatPayload,
  type PainelOkCodeRow,
  type PainelOkResumo,
  type PainelOkTech,
  type PainelOkTriple,
  type RetornoMotivo,
  type RetornoOfensor,
  type RetornoResumo,
} from "./iat-parse";

/** IAT operacional começa em 01/10/2026 (Debora). */
const HIST_START = "2026-10-01";
const PAI_FROM = "2026-10-01";

export type IatDate = { d: number; m: number; y: number; key: string };

export type IatReg = {
  dt: IatDate;
  i: number;
  login: string;
  quem: string;
  status: string;
  tipo: string;
  contrato: string;
  codes: Array<{ code: number; desc: string }>;
  osRaw: string[];
  comp: string;
  validacao: string;
};

type EquipeMap = Record<
  string,
  { login: string; nome: string; base: string; setor: string; tipo: string }
>;

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

export function parseIatDate(v: unknown): IatDate | null {
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

function parseCodeDesc(s: string): { code: number; desc: string } | null {
  const m = txt(s).match(/^\s*(\d+)\s*(?:-\s*(.*))?$/);
  if (!m) return null;
  return { code: Number(m[1]), desc: fold(m[2] || "") };
}

function mapCols(header: unknown[]) {
  const c: {
    data?: number;
    login?: number;
    status?: number;
    quem?: number;
    tipo?: number;
    contrato?: number;
    baixa: number[];
    os: number[];
    comp?: number;
    validacao?: number;
  } = { baixa: [], os: [] };
  header.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    if (
      c.data == null &&
      (f === "DATA" ||
        (f.indexOf("DATA") === 0 &&
          f.indexOf("DATA_") !== 0 &&
          f.indexOf("DATA ARQ") !== 0))
    ) {
      c.data = i;
    }
    if (f.indexOf("LOGIN DO TECNICO") >= 0) c.login = i;
    if (f.indexOf("STATUS DA ATIVIDADE") >= 0) c.status = i;
    if (f.indexOf("CONCLUIU ATIVIDADE") >= 0) c.quem = i;
    if (f === "TIPO DE ATIVIDADE") c.tipo = i;
    if (f === "CONTRATO" && c.contrato == null) c.contrato = i;
    if (/^COD DE BAIXA \d+$/.test(f)) c.baixa.push(i);
    if (/^TIPO O\.?S \d+$/.test(f) || /^TIPO OS \d+$/.test(f)) c.os.push(i);
    if (f.indexOf("COMPLEMENTO") >= 0 && c.comp == null) c.comp = i;
    if (f.indexOf("VALIDACAO BAIXA") >= 0 && c.validacao == null) c.validacao = i;
  });
  return c;
}

export function parseBaseIatRegs(rows: unknown[][]): {
  regs: IatReg[];
  dup: number;
} {
  if (!rows.length) return { regs: [], dup: 0 };
  const c = mapCols(rows[0] || []);
  const regs: IatReg[] = [];
  const vistos = new Set<string>();
  let dup = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some((x) => x !== "" && x != null)) continue;
    const dt = parseIatDate(row[c.data ?? 0]);
    if (!dt) continue;
    const chave = row.map((x) => txt(x)).join("\u0001");
    if (vistos.has(chave)) {
      dup += 1;
      continue;
    }
    vistos.add(chave);
    const codes = (c.baixa || [])
      .map((i) => parseCodeDesc(txt(row[i])))
      .filter(Boolean) as Array<{ code: number; desc: string }>;
    regs.push({
      dt,
      i: r,
      login: c.login != null ? fold(row[c.login]) : "",
      quem: c.quem != null ? fold(row[c.quem]) : "",
      status: c.status != null ? fold(row[c.status]) : "",
      tipo: c.tipo != null ? fold(row[c.tipo]) : "",
      contrato: c.contrato != null ? txt(row[c.contrato]) : "",
      codes,
      osRaw: (c.os || []).map((i) => txt(row[i])).filter(Boolean),
      comp: c.comp != null ? fold(row[c.comp]) : "",
      validacao: c.validacao != null ? txt(row[c.validacao]) : "",
    });
  }
  regs.sort((a, b) =>
    a.dt.key < b.dt.key ? -1 : a.dt.key > b.dt.key ? 1 : a.i - b.i,
  );
  return { regs, dup };
}

function buildEquipeMap(equipe: EquipeRow[]): EquipeMap {
  const por: EquipeMap = {};
  for (const e of equipe) {
    const login = fold(e.login);
    const nome = fold(e.nome);
    if (!login || !nome) continue;
    const p = {
      login,
      nome,
      base: fold(e.base),
      setor: fold(e.setor),
      tipo: fold(e.tipo),
    };
    por[login] = p;
    por[nome] = p;
  }
  return por;
}

function soDesconexao(p: { setor: string } | null): boolean {
  return Boolean(
    p && p.setor.indexOf("IAT") < 0 && p.setor.indexOf("DESCONEX") >= 0,
  );
}

function pessoa(
  eq: EquipeMap,
  r: IatReg,
): { login: string; nome: string; base: string; setor: string; tipo: string } | null {
  return eq[r.login] || eq[r.quem] || null;
}

function baseKey(p: { base: string }): "CANOAS" | "PORTO ALEGRE" {
  return p.base === "CANOAS" ? "CANOAS" : "PORTO ALEGRE";
}

function valido(r: IatReg): boolean {
  if (r.status !== "CONCLUIDO") return false;
  if (r.tipo.indexOf("NA BASE") === 0 || r.tipo.indexOf("REFEI") === 0)
    return false;
  return true;
}

function isRetorno(r: IatReg): boolean {
  return r.tipo.indexOf("RETORNO CREDENCIADA") === 0;
}

export type MesRange = {
  mesReq: string;
  start: string;
  end: string;
  months: Array<{ y: number; m: number }>;
};

/** Recorte da visão: mês YYYY-MM ou TOTAL (set≥22/09 + out + nov…). */
export function resolveMesRange(mes: string, maxKey?: string): MesRange {
  const mesReq = mes.trim().toUpperCase() === "TOTAL" ? "TOTAL" : mes.trim();
  const endCap = maxKey || "2099-12-31";
  if (mesReq === "TOTAL") {
    // Meses concretos preenchidos em buildIatFromBase a partir da BASE.
    return {
      mesReq,
      start: HIST_START,
      end: endCap,
      months: [],
    };
  }
  const [ys, ms] = mesReq.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const start = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let end = `${y}-${pad(m)}-${pad(lastDay)}`;
  if (end > endCap) end = endCap;
  if (start < HIST_START) {
    return { mesReq, start: HIST_START, end, months: [{ y, m }] };
  }
  return { mesReq, start, end, months: [{ y, m }] };
}

/** Meses YYYY-MM presentes na BASE desde HIST_START. */
export function listMesesBase(regs: IatReg[]): string[] {
  const set = new Set<string>();
  for (const r of regs) {
    if (r.dt.key < HIST_START) continue;
    set.add(`${r.dt.y}-${pad(r.dt.m)}`);
  }
  return [...set].sort();
}

function inRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

type DayCell = { prod: number; imp: number };

function countMonthContracts(
  regs: IatReg[],
  eq: EquipeMap,
  y: number,
  m: number,
  start: string,
  end: string,
): {
  byBase: Record<"CANOAS" | "PORTO ALEGRE", { prod: number; imp: number }>;
  byTech: Record<
    string,
    {
      nome: string;
      base: "CANOAS" | "PORTO ALEGRE";
      days: Record<number, DayCell>;
      prod: number;
      imp: number;
    }
  >;
} {
  const ultimo: Record<
    string,
    {
      who: string;
      base: "CANOAS" | "PORTO ALEGRE";
      dia: number;
      ok: boolean;
    }
  > = {};
  for (const r of regs) {
    if (r.dt.y !== y || r.dt.m !== m) continue;
    if (!inRange(r.dt.key, start, end)) continue;
    if (!valido(r) || !r.contrato) continue;
    const p = pessoa(eq, r);
    if (!p || soDesconexao(p)) continue;
    ultimo[r.contrato] = {
      who: p.nome,
      base: baseKey(p),
      dia: r.dt.d,
      ok: r.codes.some((c) => c.code === 409),
    };
  }
  const byBase = {
    CANOAS: { prod: 0, imp: 0 },
    "PORTO ALEGRE": { prod: 0, imp: 0 },
  };
  const byTech: Record<
    string,
    {
      nome: string;
      base: "CANOAS" | "PORTO ALEGRE";
      days: Record<number, DayCell>;
      prod: number;
      imp: number;
    }
  > = {};
  for (const u of Object.values(ultimo)) {
    if (!byTech[u.who]) {
      byTech[u.who] = {
        nome: u.who,
        base: u.base,
        days: {},
        prod: 0,
        imp: 0,
      };
    }
    const t = byTech[u.who];
    if (!t.days[u.dia]) t.days[u.dia] = { prod: 0, imp: 0 };
    if (u.ok) {
      t.days[u.dia].prod += 1;
      t.prod += 1;
      byBase[u.base].prod += 1;
    } else {
      t.days[u.dia].imp += 1;
      t.imp += 1;
      byBase[u.base].imp += 1;
    }
  }
  return { byBase, byTech };
}

function buildBlocos(
  byTech: Record<
    string,
    {
      nome: string;
      base: "CANOAS" | "PORTO ALEGRE";
      days: Record<number, DayCell>;
      prod: number;
      imp: number;
    }
  >,
  diasHeader: number[],
): IatBlock[] {
  const bases: Array<"CANOAS" | "PORTO ALEGRE"> = ["CANOAS", "PORTO ALEGRE"];
  const kinds: Array<"produtivas" | "improdutivas"> = [
    "produtivas",
    "improdutivas",
  ];
  const blocos: IatBlock[] = [];
  for (const kind of kinds) {
    for (const base of bases) {
      const list = Object.values(byTech)
        .filter((t) => t.base === base)
        .map((t) => {
          const dias = diasHeader.map((d) =>
            kind === "produtivas" ? t.days[d]?.prod || 0 : t.days[d]?.imp || 0,
          );
          const total = kind === "produtivas" ? t.prod : t.imp;
          return { tecnico: t.nome, dias, total };
        })
        .filter((t) => t.total > 0)
        .sort(
          (a, b) => b.total - a.total || a.tecnico.localeCompare(b.tecnico),
        );
      blocos.push({ base, kind, diasHeader: [...diasHeader], tecnicos: list });
    }
  }
  return blocos;
}

function findPai(
  regs: IatReg[],
  eq: EquipeMap,
  contrato: string,
  retKey: string,
  retIndex: number,
): {
  login: string;
  nome: string;
  base: "CANOAS" | "PORTO ALEGRE";
  dt: string;
  tipo: string;
  had409: boolean;
} | null {
  let last: {
    login: string;
    nome: string;
    base: "CANOAS" | "PORTO ALEGRE";
    dt: string;
    tipo: string;
    had409: boolean;
  } | null = null;
  for (const r of regs) {
    if (r.dt.key < PAI_FROM) continue;
    if (r.dt.key > retKey) break;
    if (r.dt.key === retKey && r.i >= retIndex) continue;
    if (!valido(r) || isRetorno(r) || r.contrato !== contrato) continue;
    const p = pessoa(eq, r);
    if (!p || soDesconexao(p)) continue;
    last = {
      login: p.login,
      nome: p.nome,
      base: baseKey(p),
      dt: r.dt.key,
      tipo: r.tipo,
      had409: r.codes.some((c) => c.code === 409),
    };
  }
  return last;
}

function classEnd(comp: string): "casa" | "predio" | "ni" {
  const c = fold(comp);
  if (!c) return "ni";
  // LOJA também aparece como LJ na BASE.
  if (/APT|\bBL\b|TORRE|\bTOR\b|SALA|LOJA|\bLJ\b|EDIFIC/.test(c))
    return "predio";
  if (c.includes("CASA")) return "casa";
  return "ni";
}

function isAdesaoOs(os: string): boolean {
  return fold(os).includes("ADESAO");
}

function isMigracaoOs(os: string): boolean {
  const f = fold(os);
  return f.includes("MUDANCA DE ENDERECO") || f.includes("MIGRAC");
}

function parseOsCode(os: string): { code: string; desc: string } | null {
  const m = txt(os).match(/^\s*(\d+)\s*(?:-\s*(.*))?$/);
  if (!m) return null;
  return { code: m[1], desc: fold(m[2] || "") };
}

/** Tipo de pendência a partir da coluna Validação Baixa (sem mapa hardcoded de códigos). */
function tipoPendenciaFromValidacao(validacao: string): string {
  const f = fold(validacao);
  if (!f) return "—";
  if (f.includes("REAGEND")) return "Reagendamento";
  if (f.includes("BAIXA REALIZADA") || f.includes("JA BAIXADA") || f.includes("ENCERR"))
    return "Baixa encerrada";
  return "Outro (Validação Baixa)";
}

function emptyTriple(): PainelOkTriple {
  return { canoas: 0, poa: 0, total: 0 };
}

function bumpTriple(t: PainelOkTriple, base: "CANOAS" | "PORTO ALEGRE", n = 1) {
  if (base === "CANOAS") t.canoas += n;
  else t.poa += n;
  t.total += n;
}

function sortCodeRows(
  map: Map<string, { desc: string; canoas: number; poa: number; tipo?: string }>,
): PainelOkCodeRow[] {
  return [...map.entries()]
    .map(([codigo, v]) => ({
      codigo,
      descricao: v.desc,
      canoas: v.canoas,
      poa: v.poa,
      total: v.canoas + v.poa,
      tipo_pendencia: v.tipo,
    }))
    .sort((a, b) => b.total - a.total || Number(a.codigo) - Number(b.codigo));
}

function topOfensor(
  map: Map<string, number>,
): string {
  let best = "";
  let n = 0;
  for (const [k, v] of map) {
    if (v > n || (v === n && k < best)) {
      n = v;
      best = k;
    }
  }
  return best ? `${best} (${n})` : "";
}

function computePainelOk(
  regs: IatReg[],
  eq: EquipeMap,
  start: string,
  end: string,
): {
  resumo: PainelOkResumo;
  tecnicos: PainelOkTech[];
  irreprodutiveis: string[];
} {
  const ultimo: Record<
    string,
    {
      p: { login: string; nome: string; base: string; tipo: string };
      codes: IatReg["codes"];
      osRaw: string[];
      comp: string;
      validacao: string;
    }
  > = {};
  for (const r of regs) {
    if (!inRange(r.dt.key, start, end)) continue;
    if (!valido(r) || !r.contrato) continue;
    const p = pessoa(eq, r);
    if (!p || soDesconexao(p)) continue;
    ultimo[r.contrato] = {
      p: { login: p.login, nome: p.nome, base: p.base, tipo: p.tipo },
      codes: r.codes,
      osRaw: r.osRaw,
      comp: r.comp,
      validacao: r.validacao,
    };
  }

  const ok = emptyTriple();
  const imp = emptyTriple();
  const casa_predio = {
    ok_casa: emptyTriple(),
    ok_predio: emptyTriple(),
    ok_ni: emptyTriple(),
    imp_casa: emptyTriple(),
    imp_predio: emptyTriple(),
    imp_ni: emptyTriple(),
  };
  let adesao_ok = 0;
  let migracao_ok = 0;
  const improdutivas_adesao = emptyTriple();
  const improdutivas_migracao = emptyTriple();
  const ofImp = new Map<string, number>();
  const ofImpC = new Map<string, number>();
  const ofImpP = new Map<string, number>();
  const adesaoMap = new Map<
    string,
    { desc: string; canoas: number; poa: number }
  >();
  const migracaoMap = new Map<
    string,
    { desc: string; canoas: number; poa: number }
  >();
  const adesaoImpMap = new Map<
    string,
    { desc: string; canoas: number; poa: number; tipo?: string }
  >();
  const migracaoImpMap = new Map<
    string,
    { desc: string; canoas: number; poa: number; tipo?: string }
  >();

  type TechAcc = {
    base: string;
    tecnico: string;
    login: string;
    vinculo: string;
    contratos_ok: number;
    improdutivas: number;
    adesao: number;
    migracao: number;
    ok_casa: number;
    ok_predio: number;
    ok_ni: number;
    imp_casa: number;
    imp_predio: number;
    imp_ni: number;
  };
  const byTech = new Map<string, TechAcc>();

  for (const u of Object.values(ultimo)) {
    const b = baseKey(u.p);
    const isOk = u.codes.some((c) => c.code === 409);
    const endClass = classEnd(u.comp);
    const row: TechAcc = byTech.get(u.p.login) || {
      base: b,
      tecnico: u.p.nome,
      login: u.p.login,
      vinculo: u.p.tipo,
      contratos_ok: 0,
      improdutivas: 0,
      adesao: 0,
      migracao: 0,
      ok_casa: 0,
      ok_predio: 0,
      ok_ni: 0,
      imp_casa: 0,
      imp_predio: 0,
      imp_ni: 0,
    };
    const hasAd = u.osRaw.some(isAdesaoOs);
    const hasMig = u.osRaw.some(isMigracaoOs);

    if (isOk) {
      bumpTriple(ok, b);
      row.contratos_ok += 1;
      if (endClass === "casa") {
        bumpTriple(casa_predio.ok_casa, b);
        row.ok_casa += 1;
      } else if (endClass === "predio") {
        bumpTriple(casa_predio.ok_predio, b);
        row.ok_predio += 1;
      } else {
        bumpTriple(casa_predio.ok_ni, b);
        row.ok_ni += 1;
      }
      for (const os of u.osRaw) {
        const parsed = parseOsCode(os);
        if (!parsed) continue;
        if (isAdesaoOs(os)) {
          adesao_ok += 1;
          row.adesao += 1;
          const m = adesaoMap.get(parsed.code) || {
            desc: parsed.desc,
            canoas: 0,
            poa: 0,
          };
          if (b === "CANOAS") m.canoas += 1;
          else m.poa += 1;
          adesaoMap.set(parsed.code, m);
        }
        if (isMigracaoOs(os)) {
          migracao_ok += 1;
          row.migracao += 1;
          const m = migracaoMap.get(parsed.code) || {
            desc: parsed.desc,
            canoas: 0,
            poa: 0,
          };
          if (b === "CANOAS") m.canoas += 1;
          else m.poa += 1;
          migracaoMap.set(parsed.code, m);
        }
      }
    } else {
      bumpTriple(imp, b);
      row.improdutivas += 1;
      if (endClass === "casa") {
        bumpTriple(casa_predio.imp_casa, b);
        row.imp_casa += 1;
      } else if (endClass === "predio") {
        bumpTriple(casa_predio.imp_predio, b);
        row.imp_predio += 1;
      } else {
        bumpTriple(casa_predio.imp_ni, b);
        row.imp_ni += 1;
      }
      const motivo = u.codes.find((c) => c.code !== 409) || u.codes[0];
      if (motivo) {
        const k = `${motivo.code} - ${motivo.desc}`;
        ofImp.set(k, (ofImp.get(k) || 0) + 1);
        if (b === "CANOAS") ofImpC.set(k, (ofImpC.get(k) || 0) + 1);
        else ofImpP.set(k, (ofImpP.get(k) || 0) + 1);
      }
      const tipoP = tipoPendenciaFromValidacao(u.validacao);
      if (hasAd) {
        bumpTriple(improdutivas_adesao, b);
        if (motivo) {
          const m = adesaoImpMap.get(String(motivo.code)) || {
            desc: motivo.desc,
            canoas: 0,
            poa: 0,
            tipo: tipoP,
          };
          if (b === "CANOAS") m.canoas += 1;
          else m.poa += 1;
          m.tipo = tipoP;
          adesaoImpMap.set(String(motivo.code), m);
        }
      }
      if (hasMig) {
        bumpTriple(improdutivas_migracao, b);
        if (motivo) {
          const m = migracaoImpMap.get(String(motivo.code)) || {
            desc: motivo.desc,
            canoas: 0,
            poa: 0,
            tipo: tipoP,
          };
          if (b === "CANOAS") m.canoas += 1;
          else m.poa += 1;
          m.tipo = tipoP;
          migracaoImpMap.set(String(motivo.code), m);
        }
      }
    }
    byTech.set(u.p.login, row);
  }

  const den = ok.total + imp.total;
  const pct = {
    canoas: ok.canoas + imp.canoas > 0 ? ok.canoas / (ok.canoas + imp.canoas) : 0,
    poa: ok.poa + imp.poa > 0 ? ok.poa / (ok.poa + imp.poa) : 0,
    total: den > 0 ? ok.total / den : 0,
  };

  const tecnicos: PainelOkTech[] = [...byTech.values()]
    .sort(
      (a, b) =>
        b.contratos_ok - a.contratos_ok ||
        a.tecnico.localeCompare(b.tecnico),
    )
    .map((t, i) => {
      const d = t.contratos_ok + t.improdutivas;
      return {
        base: t.base,
        pos: `${i + 1}º`,
        tecnico: t.tecnico,
        login: t.login,
        vinculo: t.vinculo,
        contratos_ok: t.contratos_ok,
        improdutivas: t.improdutivas,
        pct_painel: d > 0 ? t.contratos_ok / d : 0,
        adesao: t.adesao,
        migracao: t.migracao,
        ok_casa: t.ok_casa,
        ok_predio: t.ok_predio,
        ok_ni: t.ok_ni,
        imp_casa: t.imp_casa,
        imp_predio: t.imp_predio,
        imp_ni: t.imp_ni,
      };
    });

  const irreprodutiveis: string[] = [
    "Cards Neutra WhatsApp por técnico (texto pronto) não são gerados — o site mostra ranking por técnico com casa/prédio e tarefas.",
    "Rótulo 'Tipo de pendência' da aba estática usava mapa fixo por código; no site vem da coluna Validação Baixa (Reagendamento / Baixa encerrada / Outro).",
  ];

  return {
    resumo: {
      contratos_ok: ok,
      improdutivas: imp,
      pct_painel: pct,
      adesao_ok,
      migracao_ok,
      improdutivas_adesao,
      improdutivas_migracao,
      ofensor: topOfensor(ofImp),
      ofensor_canoas: topOfensor(ofImpC),
      ofensor_poa: topOfensor(ofImpP),
      periodo_nota: `Fonte: BASE IAT · ${start} a ${end} · contagem por contrato (último registro) · Contrato OK = 409 · fora: Na Base, Refeição, sem contrato · Casa/Prédio pelo Complemento`,
      casa_predio,
      adesao_codigos: sortCodeRows(adesaoMap),
      migracao_codigos: sortCodeRows(migracaoMap),
      adesao_improd_codigos: sortCodeRows(adesaoImpMap),
      migracao_improd_codigos: sortCodeRows(migracaoImpMap),
    },
    tecnicos,
    irreprodutiveis,
  };
}

function computeRetorno(
  regs: IatReg[],
  eq: EquipeMap,
  start: string,
  end: string,
): {
  resumo: RetornoResumo;
  ofensores: RetornoOfensor[];
  motivos: RetornoMotivo[];
} {
  const retornos = regs.filter(
    (r) =>
      valido(r) &&
      isRetorno(r) &&
      r.contrato &&
      inRange(r.dt.key, start, end) &&
      pessoa(eq, r) &&
      !soDesconexao(pessoa(eq, r)),
  );

  const ofMap = new Map<
    string,
    {
      tecnico: string;
      base: string;
      login: string;
      retornos: number;
      motivos: Map<string, { n: number; desc: string }>;
      outro: number;
      sobre409: number;
    }
  >();
  const motivoMap = new Map<
    string,
    { codigo: string; descricao: string; canoas: number; poa: number; total: number }
  >();

  let conclC = 0;
  let conclP = 0;
  let gerC = 0;
  let gerP = 0;
  let difC = 0;
  let difP = 0;
  let iguC = 0;
  let iguP = 0;
  let naoC = 0;
  let naoP = 0;

  for (const r of retornos) {
    const atend = pessoa(eq, r)!;
    const atendBase = baseKey(atend);
    if (atendBase === "CANOAS") conclC += 1;
    else conclP += 1;

    const motivo = r.codes.find((c) => c.code !== 409) || r.codes[0];
    const pai = findPai(regs, eq, r.contrato, r.dt.key, r.i);
    let paiBase: "CANOAS" | "PORTO ALEGRE" = atendBase;
    let keyPai = "NAO_ID";

    if (pai) {
      keyPai = pai.login;
      paiBase = pai.base;
      if (paiBase === "CANOAS") gerC += 1;
      else gerP += 1;
      if (pai.login === atend.login) {
        if (paiBase === "CANOAS") iguC += 1;
        else iguP += 1;
      } else if (paiBase === "CANOAS") difC += 1;
      else difP += 1;
    } else if (atendBase === "CANOAS") naoC += 1;
    else naoP += 1;

    const o = ofMap.get(keyPai) || {
      tecnico: pai?.nome || "não identificado",
      base: pai ? (pai.base === "CANOAS" ? "Canoas" : "Porto Alegre") : "—",
      login: pai?.login || "—",
      retornos: 0,
      motivos: new Map(),
      outro: 0,
      sobre409: 0,
    };
    o.retornos += 1;
    if (pai && pai.login !== atend.login) o.outro += 1;
    if (pai && pai.had409 && pai.dt >= start && pai.dt <= end) o.sobre409 += 1;
    if (motivo) {
      const prev = o.motivos.get(String(motivo.code)) || {
        n: 0,
        desc: motivo.desc,
      };
      prev.n += 1;
      o.motivos.set(String(motivo.code), prev);
    }
    ofMap.set(keyPai, o);

    if (motivo) {
      const mk = String(motivo.code);
      const mm = motivoMap.get(mk) || {
        codigo: mk,
        descricao: motivo.desc,
        canoas: 0,
        poa: 0,
        total: 0,
      };
      if (paiBase === "CANOAS") mm.canoas += 1;
      else mm.poa += 1;
      mm.total += 1;
      motivoMap.set(mk, mm);
    }
  }

  const ofensores: RetornoOfensor[] = [...ofMap.entries()]
    .map(([key, o]) => {
      let top = "";
      let topDesc = "";
      let tq = 0;
      for (const [k, v] of o.motivos) {
        if (v.n > tq) {
          tq = v.n;
          top = k;
          topDesc = v.desc;
        }
      }
      return {
        key,
        pos: "",
        tecnico: o.tecnico,
        base: o.base,
        login: o.login,
        retornos: o.retornos,
        maior_motivo: top ? `${top} - ${topDesc}` : "",
        qtd_motivo: tq,
        atendidos_outro: o.outro,
        sobre_409: o.sobre409,
      };
    })
    .sort(
      (a, b) =>
        b.retornos - a.retornos || a.tecnico.localeCompare(b.tecnico),
    )
    .map((o, i) => ({
      pos: o.key === "NAO_ID" ? "—" : `${i + 1}º`,
      tecnico: o.tecnico,
      base: o.base,
      login: o.login,
      retornos: o.retornos,
      maior_motivo: o.maior_motivo,
      qtd_motivo: o.qtd_motivo,
      atendidos_outro: o.atendidos_outro,
      sobre_409: o.sobre_409,
    }));

  const motivos = [...motivoMap.values()].sort(
    (a, b) => b.total - a.total || Number(a.codigo) - Number(b.codigo),
  );
  const topMotivo = motivos[0];
  const maior_motivo = topMotivo
    ? `${topMotivo.codigo} - ${topMotivo.descricao} (${topMotivo.total})`
    : "";

  return {
    resumo: {
      retornos_concluidos: {
        canoas: conclC,
        poa: conclP,
        total: conclC + conclP,
      },
      retornos_gerados: { canoas: gerC, poa: gerP, total: gerC + gerP },
      pai_diferente: { canoas: difC, poa: difP, total: difC + difP },
      pai_igual: { canoas: iguC, poa: iguP, total: iguC + iguP },
      pai_nao_id: { canoas: naoC, poa: naoP, total: naoC + naoP },
      maior_motivo,
      periodo_nota: `Fonte: BASE IAT · retornos ${start} a ${end} · Retorno Credenciada · pai = último concluído não-retorno desde ${PAI_FROM}`,
    },
    ofensores,
    motivos,
  };
}

export function buildIatFromBase(opts: {
  baseRows: unknown[][];
  equipeRows: unknown[][];
  mes: string;
  /** Opcional: limitar o fim do recorte (aceite até 08/11). */
  ate?: string;
}): Omit<IatPayload, "atualizado_em" | "fonte" | "status" | "mensagem"> & {
  dup: number;
  regras_irreprodutiveis: string[];
} {
  const equipe = parseEquipe(opts.equipeRows);
  const eq = buildEquipeMap(equipe);
  const { regs, dup } = parseBaseIatRegs(opts.baseRows);
  const maxKey =
    regs.reduce((m, r) => (r.dt.key > m ? r.dt.key : m), "") || undefined;
  const meses_disponiveis = listMesesBase(regs);
  const range = resolveMesRange(opts.mes, opts.ate || maxKey);
  const { mesReq, start, end } = range;
  const months =
    mesReq === "TOTAL"
      ? meses_disponiveis.map((ym) => {
          const [y, m] = ym.split("-").map(Number);
          return { y, m };
        })
      : range.months;

  const mergedTech: Record<
    string,
    {
      nome: string;
      base: "CANOAS" | "PORTO ALEGRE";
      days: Record<number, DayCell>;
      prod: number;
      imp: number;
    }
  > = {};
  const resumoAcc = {
    CANOAS: { prod: 0, imp: 0 },
    "PORTO ALEGRE": { prod: 0, imp: 0 },
  };
  const diasSet = new Set<number>();

  for (const { y, m } of months) {
    const { byBase, byTech } = countMonthContracts(
      regs,
      eq,
      y,
      m,
      start,
      end,
    );
    resumoAcc.CANOAS.prod += byBase.CANOAS.prod;
    resumoAcc.CANOAS.imp += byBase.CANOAS.imp;
    resumoAcc["PORTO ALEGRE"].prod += byBase["PORTO ALEGRE"].prod;
    resumoAcc["PORTO ALEGRE"].imp += byBase["PORTO ALEGRE"].imp;
    for (const t of Object.values(byTech)) {
      if (!mergedTech[t.nome]) {
        mergedTech[t.nome] = {
          nome: t.nome,
          base: t.base,
          days: {},
          prod: 0,
          imp: 0,
        };
      }
      const mt = mergedTech[t.nome];
      mt.prod += t.prod;
      mt.imp += t.imp;
      for (const [dStr, cell] of Object.entries(t.days)) {
        const d = Number(dStr);
        diasSet.add(d);
        if (!mt.days[d]) mt.days[d] = { prod: 0, imp: 0 };
        mt.days[d].prod += cell.prod;
        mt.days[d].imp += cell.imp;
      }
    }
  }

  const diasHeader =
    mesReq === "TOTAL"
      ? [...diasSet].sort((a, b) => a - b)
      : Array.from({ length: 31 }, (_, i) => i + 1);

  const blocos = buildBlocos(mergedTech, diasHeader);
  const resumo: IatPayload["resumo"] = (
    ["CANOAS", "PORTO ALEGRE"] as const
  ).map((base) => {
    const v = resumoAcc[base];
    const tot = v.prod + v.imp;
    return {
      base,
      produtivas: v.prod,
      improdutivas: v.imp,
      total_contratos: tot,
      pct_produtivas: tot > 0 ? v.prod / tot : 0,
    };
  });
  const totP = resumoAcc.CANOAS.prod + resumoAcc["PORTO ALEGRE"].prod;
  const totI = resumoAcc.CANOAS.imp + resumoAcc["PORTO ALEGRE"].imp;
  const totC = totP + totI;
  resumo.push({
    base: "TOTAL",
    produtivas: totP,
    improdutivas: totI,
    total_contratos: totC,
    pct_produtivas: totC > 0 ? totP / totC : 0,
  });

  const ranking = Object.values(mergedTech)
    .map((t) => ({
      tecnico: t.nome,
      base: t.base,
      produtivas: t.prod,
      improdutivas: t.imp,
    }))
    .sort(
      (a, b) =>
        b.produtivas - a.produtivas || a.tecnico.localeCompare(b.tecnico),
    );

  const painel = computePainelOk(regs, eq, start, end);
  const retorno = computeRetorno(regs, eq, start, end);

  const dados_ate = maxKey || null;
  const dados_ate_br = dados_ate
    ? `${dados_ate.slice(8, 10)}/${dados_ate.slice(5, 7)}`
    : null;
  const mesLabel =
    mesReq === "TOTAL"
      ? "TOTAL · BASE IAT (desde 01/10)"
      : `BASE IAT · ${mesReq}`;
  const titulo = dados_ate_br
    ? `PRODUTIVAS E IMPRODUTIVAS — ${mesLabel} · dados até ${dados_ate_br}`
    : `PRODUTIVAS E IMPRODUTIVAS — ${mesLabel}`;

  return {
    titulo,
    dados_ate,
    dados_ate_br,
    meses_disponiveis,
    mes: mesReq,
    mes_aba: maxKey ? maxKey.slice(0, 7) : null,
    blocos,
    resumo,
    ranking,
    painel_ok: {
      resumo: painel.resumo,
      tecnicos: painel.tecnicos,
      irreprodutiveis: painel.irreprodutiveis,
    },
    retorno,
    equipe,
    dup,
    regras_irreprodutiveis: painel.irreprodutiveis,
  };
}
