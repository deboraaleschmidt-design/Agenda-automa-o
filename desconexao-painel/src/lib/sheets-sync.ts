import { google } from "googleapis";
import { sql } from "./db";
import { buildFixturePayload } from "./fixture";
import { inspectServiceAccountJson } from "./sheets-creds";
import {
  countsToList,
  emptyServicoCounts,
  mapRespostasHeader,
  monthKeyFromCell,
  normalizeServico,
  parseMesParam,
} from "./servico";
import {
  EMPRESA_SEED_ID,
  MONTH_KEYS,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  SPREADSHEET_ID,
  TECH_LABELS,
  type PainelPayload,
} from "./types";

type SyncResult = {
  payload: PainelPayload;
  usedFixture: boolean;
};

export async function syncPainelSnapshot(mes: string): Promise<SyncResult> {
  const parsed = parseMesParam(mes);
  if (!parsed) {
    const payload = buildFixturePayload(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      "Mês inválido. Use YYYY-MM.",
    );
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
  }

  const inspected = inspectServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  if (!inspected.ok || !inspected.parsed) {
    const payload = buildFixturePayload(mes, inspected.reason);
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
  }

  try {
    const payload = await readFromSheets(mes, inspected.parsed);
    await upsertSnapshot(payload);
    return { payload, usedFixture: false };
  } catch (error) {
    const payload = buildFixturePayload(mes, humanizeSheetsError(error));
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
  }
}

function humanizeSheetsError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || "");
  const lower = msg.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("forbidden") ||
    lower.includes("403") ||
    lower.includes("the caller does not have permission")
  ) {
    return `Sem permissão na planilha. Compartilhe com ${inspectedEmailHint()} como Editor ou Leitor e tente de novo.`;
  }
  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("unable to parse range")
  ) {
    return "Planilha ou aba não encontrada. Confira GOOGLE_SHEETS_ID e se existem as abas PAINEL, PAINEL RECOLHAS e Respostas ao formulário 1.";
  }
  if (
    lower.includes("invalid_grant") ||
    lower.includes("invalid jwt") ||
    lower.includes("private key") ||
    lower.includes("decoder") ||
    lower.includes("decrypt")
  ) {
    return "JSON da service account inválido ou chave corrompida. Em My Secrets, edite GOOGLE_SERVICE_ACCOUNT_JSON e cole de novo o arquivo .json completo.";
  }
  if (lower.includes("sheets.googleapis.com") && lower.includes("has not been used")) {
    return "Ative a Google Sheets API no projeto n8n-integracao (APIs e serviços → Biblioteca).";
  }
  return "Não foi possível ler a planilha agora. Confira compartilhamento com a service account, Sheets API ativa e o JSON em My Secrets; aguarde 1 minuto e clique Sincronizar uma vez.";
}

function inspectedEmailHint(): string {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "";
    const email = (JSON.parse(raw) as { client_email?: string }).client_email;
    return email || "o e-mail …@….iam.gserviceaccount.com";
  } catch {
    return "desconexao-painel-reader@n8n-integracao-494215.iam.gserviceaccount.com";
  }
}

async function upsertSnapshot(payload: PainelPayload): Promise<void> {
  await sql(
    `INSERT INTO painel_snapshots
       (id, empresa_id, setor, mes, payload, fonte, atualizado_em)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (empresa_id, setor, mes) DO UPDATE SET
       payload = EXCLUDED.payload,
       fonte = EXCLUDED.fonte,
       atualizado_em = EXCLUDED.atualizado_em`,
    [
      crypto.randomUUID(),
      EMPRESA_SEED_ID,
      SETOR_DESCONEXAO,
      payload.mes,
      JSON.stringify(payload),
      payload.fonte,
      payload.atualizado_em,
    ],
  );
}

async function readFromSheets(
  mes: string,
  credentials: { client_email: string; private_key: string },
): Promise<PainelPayload> {
  const key = credentials.private_key.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = SPREADSHEET_ID;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      "PAINEL!A3:D4",
      "PAINEL!A8:AG13",
      "PAINEL!A15:N40",
      "'PAINEL RECOLHAS'!A4:E40",
      "'Respostas ao formulário 1'!A1:S",
    ],
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const ranges = res.data.valueRanges || [];
  const kpiBlock = ranges[0]?.values || [];
  const gradeBlock = ranges[1]?.values || [];
  const cityBlock = ranges[2]?.values || [];
  const pagarBlock = ranges[3]?.values || [];
  const respostas = ranges[4]?.values || [];

  const kpiValues = kpiBlock[1] || [];
  const recolhidos = num(kpiValues[0]);
  const entregues = num(kpiValues[1]);
  const em_processo = num(kpiValues[2]);
  let pct = num(kpiValues[3]);
  if (pct > 1) pct = pct / 100;

  const techOrder = ["Z698465", "Z698466", "SMA", "TCI"];
  const colunas = techOrder.map((codigo) => ({
    nome: TECH_LABELS[codigo] || codigo,
    codigo,
  }));

  const byCode: Record<string, number[]> = {};
  for (const row of gradeBlock.slice(1)) {
    const code = String(row[0] || "").trim().toUpperCase();
    if (!techOrder.includes(code)) continue;
    byCode[code] = row.slice(1, 32).map((v) => num(v));
  }

  const dias: number[][] = [];
  for (let d = 1; d <= 31; d++) {
    const counts = techOrder.map((c) => byCode[c]?.[d - 1] ?? 0);
    if (counts.every((n) => n === 0)) continue;
    dias.push([d, ...counts]);
  }

  const por_cidade_mes: PainelPayload["por_cidade_mes"] = [];
  for (const row of cityBlock.slice(2)) {
    const cidade = String(row[0] || "").trim();
    if (!cidade || cidade.toUpperCase() === "TOTAL") continue;
    if (cidade.toUpperCase().includes("EVOLU")) break;
    const meses: Record<string, number> = {};
    MONTH_KEYS.forEach((k, i) => {
      meses[k] = num(row[i + 1]);
    });
    const total = num(row[13]) || Object.values(meses).reduce((a, b) => a + b, 0);
    por_cidade_mes.push({ cidade, meses, total });
  }

  const evolucao_mensal: PainelPayload["evolucao_mensal"] = [];
  let inEvo = false;
  for (const row of cityBlock) {
    const a = String(row[0] || "").trim().toUpperCase();
    if (a.includes("EVOLU")) {
      inEvo = true;
      continue;
    }
    if (!inEvo) continue;
    if (a === "MÊS" || a === "MES") continue;
    if (!a) continue;
    evolucao_mensal.push({ mes: a.slice(0, 3), recolhas: num(row[1]) });
  }
  if (evolucao_mensal.length === 0) {
    for (let i = 0; i < 12; i++) {
      const k = MONTH_KEYS[i];
      const recolhas = por_cidade_mes.reduce(
        (sum, c) => sum + (c.meses[k] || 0),
        0,
      );
      evolucao_mensal.push({ mes: k, recolhas });
    }
  }

  const a_pagar: PainelPayload["a_pagar"] = [];
  for (const row of pagarBlock.slice(1)) {
    const tecnico = String(row[0] || "").trim();
    if (!tecnico || tecnico.toUpperCase().startsWith("TOTAL")) continue;
    a_pagar.push({
      tecnico,
      codigo: "",
      volume: num(row[1]),
      tarifa: num(row[2]),
      valor: num(row[3]),
    });
  }

  return {
    empresa: { id: EMPRESA_SEED_ID, nome_publico: NOME_PUBLICO },
    setor: SETOR_DESCONEXAO,
    mes,
    atualizado_em: new Date().toISOString(),
    fonte: "sheets",
    status: "ok",
    kpis: { recolhidos, entregues, em_processo, pct_entregue: pct },
    grade_tecnicos: { colunas, dias },
    por_cidade_mes,
    evolucao_mensal,
    por_tipo_servico: aggregateServicos(respostas, mes),
    a_pagar,
  };
}

function aggregateServicos(
  respostas: unknown[][],
  mes: string,
): PainelPayload["por_tipo_servico"] {
  const target = parseMesParam(mes);
  const counts: Record<string, number> = { ...emptyServicoCounts(), OUTROS: 0 };
  if (!target || respostas.length < 2) return countsToList(counts);

  const map = mapRespostasHeader(respostas[0] || []);
  const servicoCol = map.servico >= 0 ? map.servico : 11;

  for (let i = 1; i < respostas.length; i++) {
    const row = respostas[i] || [];
    if (map.serial >= 0 && !String(row[map.serial] || "").trim()) continue;
    const dataVal = map.data >= 0 ? row[map.data] : undefined;
    const tsVal = map.ts >= 0 ? row[map.ts] : undefined;
    const periodVal = map.period >= 0 ? row[map.period] : undefined;
    const mk =
      monthKeyFromCell(dataVal, periodVal) ||
      monthKeyFromCell(tsVal, periodVal);
    if (!mk || mk.y !== target.y || mk.m !== target.m) continue;
    const tipo = normalizeServico(row[servicoCol]);
    counts[tipo] = (counts[tipo] || 0) + 1;
  }
  return countsToList(counts);
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
