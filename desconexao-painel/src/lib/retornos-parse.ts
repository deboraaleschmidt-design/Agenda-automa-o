import { num } from "./painel-parse";

export type RetornoOfensorItem = {
  label: string;
  retornos: number;
};

export type RetornoLinha = {
  contrato: string;
  n_retorno: number;
  data_pai: string;
  tecnico_pai: string;
  pai_codigos: string;
  pai_fechamento: string;
  data_retorno: string;
  data_hora_atendimento: string;
  tecnico_atendeu: string;
  fechamento: string;
  motivo: string;
  observacao: string;
  grupo: "COM HISTÓRICO" | "SEM HISTÓRICO TCI" | string;
};

export type RetornosPayload = {
  atualizado_em: string;
  fonte: "sheets" | "fixture";
  status: "ok" | "aguardando_credencial_sheets";
  mensagem?: string;
  titulo: string;
  periodo_nota: string;
  resumo: {
    total_retornos: number;
    contratos: number;
    contratos_2plus: number;
    sem_historico: number;
    com_historico: number;
    set: number;
    out: number;
    nov: number;
    texto: string;
  };
  ofensor_fechamento: RetornoOfensorItem[];
  ofensor_pai: RetornoOfensorItem[];
  ofensor_atendeu: RetornoOfensorItem[];
  com_historico: RetornoLinha[];
  sem_historico: RetornoLinha[];
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

function parseResumoLine(txt: string): RetornosPayload["resumo"] {
  const pick = (re: RegExp) => {
    const m = txt.match(re);
    return m ? Number(m[1]) : 0;
  };
  return {
    total_retornos: pick(/Total de retornos:\s*(\d+)/i),
    contratos: pick(/Contratos:\s*(\d+)/i),
    contratos_2plus: pick(/Contratos com 2\+ retornos:\s*(\d+)/i),
    sem_historico: pick(/SEM HIST[ÓO]RICO TCI:\s*(\d+)/i),
    com_historico: pick(/Com hist[óo]rico:\s*(\d+)/i),
    set: pick(/SET\s*(\d+)/i),
    out: pick(/OUT\s*(\d+)/i),
    nov: pick(/NOV\s*(\d+)/i),
    texto: txt,
  };
}

function parseOfensorCol(
  rows: unknown[][],
  start: number,
  end: number,
  labelCol: number,
  qtdCol: number,
): RetornoOfensorItem[] {
  const out: RetornoOfensorItem[] = [];
  for (let i = start; i < end; i++) {
    const label = cell(rows[i], labelCol);
    if (!label) continue;
    const u = fold(label);
    if (u === "TOTAL" || u.startsWith("FECHAMENTO") || u.startsWith("TECNICO"))
      continue;
    const q = num(rows[i]?.[qtdCol]);
    if (!q && !/SEM HIST/.test(u)) continue;
    out.push({ label, retornos: q });
  }
  return out;
}

function parseLinha(row: unknown[]): RetornoLinha | null {
  const contrato = cell(row, 0);
  if (!contrato || !/^\d/.test(contrato)) return null;
  const grupoRaw = fold(cell(row, 21));
  let grupo: RetornoLinha["grupo"] = cell(row, 21) || "—";
  if (grupoRaw.includes("SEM HIST")) grupo = "SEM HISTÓRICO TCI";
  else if (grupoRaw.includes("COM HIST")) grupo = "COM HISTÓRICO";
  return {
    contrato,
    n_retorno: num(row[1]) || 1,
    data_pai: cell(row, 2),
    tecnico_pai: cell(row, 3),
    pai_codigos: cell(row, 4),
    pai_fechamento: cell(row, 5),
    data_retorno: cell(row, 6),
    data_hora_atendimento: cell(row, 7),
    tecnico_atendeu: cell(row, 8),
    fechamento: cell(row, 9),
    motivo: cell(row, 10),
    observacao: cell(row, 12) || cell(row, 11),
    grupo,
  };
}

/** Espelho da aba RETORNOS (substitui RETORNO CREDENCIADA). */
export function parseRetornosSheet(rows: unknown[][]): Omit<
  RetornosPayload,
  "atualizado_em" | "fonte" | "status" | "mensagem" | "meses_disponiveis"
> {
  const titulo = cell(rows[0], 0) || "RETORNOS";
  const periodo_nota = cell(rows[1], 0) || "";
  const resumo = parseResumoLine(cell(rows[2], 0) || "");

  // Bloco OFENSOR: cols D–E fechamento, I–J pai, M–N atendeu (aprox. row 5+)
  let ofensorStart = 4;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    if (fold(cell(rows[i], 0)).includes("OFENSOR")) {
      ofensorStart = i + 2;
      break;
    }
  }
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (fold(cell(rows[i], 0)) === "CONTRATO" && fold(cell(rows[i], 1)).includes("RETORNO")) {
      headerIdx = i;
      break;
    }
  }
  const ofensorEnd = headerIdx > 0 ? headerIdx : ofensorStart + 20;
  const ofensor_fechamento = parseOfensorCol(rows, ofensorStart, ofensorEnd, 3, 5);
  const ofensor_pai = parseOfensorCol(rows, ofensorStart, ofensorEnd, 8, 9);
  const ofensor_atendeu = parseOfensorCol(rows, ofensorStart, ofensorEnd, 12, 13);

  const com_historico: RetornoLinha[] = [];
  const sem_historico: RetornoLinha[] = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const marker = fold(cell(rows[i], 0));
      if (marker.startsWith("COM HISTORICO") || marker.startsWith("SEM HISTORICO")) {
        continue;
      }
      const line = parseLinha(rows[i] || []);
      if (!line) continue;
      if (line.grupo === "SEM HISTÓRICO TCI") sem_historico.push(line);
      else com_historico.push(line);
    }
  }

  return {
    titulo,
    periodo_nota,
    resumo,
    ofensor_fechamento,
    ofensor_pai,
    ofensor_atendeu,
    com_historico,
    sem_historico,
  };
}

export function emptyRetornosPayload(mensagem?: string): RetornosPayload {
  return {
    atualizado_em: new Date().toISOString(),
    fonte: "fixture",
    status: "aguardando_credencial_sheets",
    mensagem,
    titulo: "RETORNOS",
    periodo_nota: "",
    resumo: {
      total_retornos: 0,
      contratos: 0,
      contratos_2plus: 0,
      sem_historico: 0,
      com_historico: 0,
      set: 0,
      out: 0,
      nov: 0,
      texto: "",
    },
    ofensor_fechamento: [],
    ofensor_pai: [],
    ofensor_atendeu: [],
    com_historico: [],
    sem_historico: [],
    meses_disponiveis: ["TOTAL", "2026-09", "2026-10", "2026-11"],
  };
}
