import { google } from "googleapis";
import { sql } from "./db";
import { buildFixturePayload } from "./fixture";
import {
  aggregateServicos,
  isMesOrTotal,
  parseCidadesFromPainel,
  parseGradeFromPainel,
  parseKpisFromPainel,
} from "./painel-parse";
import {
  inspectServiceAccountJson,
  readServiceAccountJsonEnv,
  SHEETS_SA_SECRET_NAME,
} from "./sheets-creds";
import {
  EMPRESA_SEED_ID,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  SPREADSHEET_ID,
  type PainelPayload,
} from "./types";

type SyncResult = {
  payload: PainelPayload;
  usedFixture: boolean;
};

export async function syncPainelSnapshot(mes: string): Promise<SyncResult> {
  if (!isMesOrTotal(mes)) {
    const payload = buildFixturePayload(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      "Mês inválido. Use YYYY-MM ou TOTAL.",
    );
    await upsertSnapshot(payload);
    return { payload, usedFixture: true };
  }

  const inspected = inspectServiceAccountJson(readServiceAccountJsonEnv());
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
    return `JSON da service account inválido ou chave corrompida. Em My Secrets, edite ${SHEETS_SA_SECRET_NAME} e cole de novo o arquivo .json completo.`;
  }
  if (lower.includes("sheets.googleapis.com") && lower.includes("has not been used")) {
    return "Ative a Google Sheets API no projeto n8n-integracao (APIs e serviços → Biblioteca).";
  }
  return `Não foi possível ler a planilha agora. Confira compartilhamento com a service account, Sheets API ativa e ${SHEETS_SA_SECRET_NAME} em My Secrets; aguarde 1 minuto e clique Sincronizar uma vez.`;
}

function inspectedEmailHint(): string {
  try {
    const raw = readServiceAccountJsonEnv()?.trim() || "";
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

  // Wide PAINEL block — parse by title, never fixed KPI columns A–D.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["PAINEL!A1:AG80", "'Respostas ao formulário 1'!A1:S"],
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const ranges = res.data.valueRanges || [];
  const painelRows = ranges[0]?.values || [];
  const respostas = ranges[1]?.values || [];

  const kpis = parseKpisFromPainel(painelRows);
  const grade = parseGradeFromPainel(painelRows);
  const cidades = parseCidadesFromPainel(painelRows);

  return {
    empresa: { id: EMPRESA_SEED_ID, nome_publico: NOME_PUBLICO },
    setor: SETOR_DESCONEXAO,
    mes,
    atualizado_em: new Date().toISOString(),
    fonte: "sheets",
    status: "ok",
    mensagem: grade.tituloMes
      ? `Grade: ${grade.tituloMes}`
      : undefined,
    kpis,
    grade_tecnicos: { colunas: grade.colunas, dias: grade.dias },
    por_cidade_mes: cidades.por_cidade_mes,
    evolucao_mensal: cidades.evolucao_mensal,
    por_tipo_servico: aggregateServicos(respostas, mes),
    // Quantidades only on team face — valores R$ ficam fora deste slice.
    a_pagar: [],
  };
}
