import { sql } from "./db";
import { buildFixturePayload } from "./fixture";
import { parseMesParam } from "./servico";
import {
  EMPRESA_SEED_ID,
  NOME_PUBLICO,
  SETOR_DESCONEXAO,
  SPREADSHEET_ID,
} from "./types";

let empresaReady = false;

function defaultMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function ensureSeed(mes?: string): Promise<void> {
  const currentMes = parseMesParam(mes || "") ? (mes as string) : defaultMes();

  if (!empresaReady) {
    await sql(
      `INSERT INTO empresas (id, nome_interno, nome_publico, spreadsheet_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         nome_publico = EXCLUDED.nome_publico,
         spreadsheet_id = EXCLUDED.spreadsheet_id`,
      [
        EMPRESA_SEED_ID,
        "operacao-piloto-slice1",
        NOME_PUBLICO,
        SPREADSHEET_ID,
      ],
    );
    empresaReady = true;
  }

  const existing = await sql<{ id: string }>(
    `SELECT id FROM painel_snapshots
     WHERE empresa_id = $1 AND setor = $2 AND mes = $3
     LIMIT 1`,
    [EMPRESA_SEED_ID, SETOR_DESCONEXAO, currentMes],
  );

  if (existing.length === 0) {
    const payload = buildFixturePayload(currentMes);
    await sql(
      `INSERT INTO painel_snapshots
         (id, empresa_id, setor, mes, payload, fonte, atualizado_em)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        crypto.randomUUID(),
        EMPRESA_SEED_ID,
        SETOR_DESCONEXAO,
        currentMes,
        JSON.stringify(payload),
        payload.fonte,
        payload.atualizado_em,
      ],
    );
  }
}
