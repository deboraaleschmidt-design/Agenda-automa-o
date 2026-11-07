import { google } from "googleapis";
import { sql } from "./db";
import { buildFixturePayload } from "./fixture";
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
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!creds) {
    const payload = buildFixturePayload(mes);
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
  }

  try {
    const payload = await readFromSheets(mes, creds);
    await upsertSnapshot(payload);
    return { payload, usedFixture: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao ler Google Sheets";
    const payload = buildFixturePayload(mes);
    payload.mensagem = `Aguardando/erro Sheets: ${message}`;
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
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
  credsRaw: string,
): Promise<PainelPayload> {
  const credentials = JSON.parse(credsRaw) as {
    client_email: string;
    private_key: string;
  };
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
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
    ],
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const ranges = res.data.valueRanges || [];
  const kpiBlock = ranges[0]?.values || [];
  const gradeBlock = ranges[1]?.values || [];
  const cityBlock = ranges[2]?.values || [];
  const pagarBlock = ranges[3]?.values || [];

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
    byCode[code] = techOrder.includes(code)
      ? row.slice(1, 32).map((v) => num(v))
      : [];
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
    const volume = num(row[1]);
    const tarifa = num(row[2]);
    const valor = num(row[3]);
    a_pagar.push({
      tecnico,
      codigo: "",
      volume,
      tarifa,
      valor,
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
    a_pagar,
  };
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace("%", "").replace(/\./g, "").replace(",", ".").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
