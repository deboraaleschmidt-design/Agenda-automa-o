/**
 * Sync só-leitura Sheets → Postgres (opção A).
 * Upsert sem duplicar; fecha meses civis já terminados.
 */
import { sql } from "./db";
import { mergeNeutraSheetRows } from "./neutra-merge";
import {
  listMesesNeutra,
  parseBaseNeutraRegs,
  parseEquipeNeutra,
} from "./neutra-engine";
import { sheetsAuthOrNull } from "./sheets-client";
import { SPREADSHEET_NEUTRA_ID } from "./types";

export type BancoSyncResult = {
  ok: boolean;
  trigger: string;
  status: string;
  mensagem: string;
  contagens: Record<string, number>;
  meses_fechados: string[];
  hist_presente: boolean;
};

function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

function anoMesFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Meses civis estritamente anteriores ao mês corrente → fechar. */
export function mesesParaFechar(hoje = new Date()): string[] {
  const cur = anoMesFromDate(hoje);
  const out: string[] = [];
  // Fecha jan–dez do ano corrente e do anterior, se < cur
  for (const y of [hoje.getFullYear() - 1, hoje.getFullYear()]) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${y}-${pad(m)}`;
      if (ym < cur) out.push(ym);
    }
  }
  return out;
}

async function fetchOptionalHist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  id: string,
): Promise<unknown[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "'BASE NEUTRA HIST'!A1:Z",
      valueRenderOption: "FORMATTED_VALUE",
    });
    return (res.data.values || []) as unknown[][];
  } catch {
    return [];
  }
}

export async function syncBancoFromSheets(opts?: {
  trigger?: string;
}): Promise<BancoSyncResult> {
  const trigger = opts?.trigger || "api";
  const runId = crypto.randomUUID();
  await sql(
    `INSERT INTO sync_runs (id, trigger, status, detalhe, ano_mes)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [runId, trigger, "running", JSON.stringify({}), "TOTAL"],
  );

  const contagens: Record<string, number> = {
    tecnicos: 0,
    atividades_neutra: 0,
    snapshots_mensais: 0,
  };
  const mesesFechados: string[] = [];
  let histPresente = false;

  try {
    const auth = sheetsAuthOrNull();
    if (!auth.ok) {
      throw new Error(auth.reason || "Credencial Sheets indisponível.");
    }
    if (!SPREADSHEET_NEUTRA_ID) {
      throw new Error(
        "GOOGLE_SHEETS_NEUTRA_ID / GOOGLE_SHEETS_D1_ID não configurado.",
      );
    }

    const [batch, histRows] = await Promise.all([
      auth.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_NEUTRA_ID,
        ranges: [
          "'BASE NEUTRA'!A1:Z",
          "'PROMPT NEUTRA'!A1:Z",
          "'EQUIPE NEUTRA'!A1:H80",
        ],
        valueRenderOption: "FORMATTED_VALUE",
      }),
      fetchOptionalHist(auth.sheets, SPREADSHEET_NEUTRA_ID),
    ]);
    const ranges = batch.data.valueRanges || [];
    const baseRows = ranges[0]?.values || [];
    const promptRows = ranges[1]?.values || [];
    const eqRows = ranges[2]?.values || [];
    const merged = mergeNeutraSheetRows({
      hist: histRows,
      base: baseRows,
      prompt: promptRows,
    });
    histPresente = merged.histPresente;

    const equipe = parseEquipeNeutra(eqRows);
    const nowYm = anoMesFromDate(new Date());
    for (const e of equipe) {
      const id = crypto.randomUUID();
      const vinculo = (e.tipo || "").toUpperCase().includes("CLT")
        ? "CLT"
        : (e.tipo || "").toUpperCase().includes("PJ")
          ? "PJ"
          : "";
      await sql(
        `INSERT INTO tecnicos
           (id, segmento, nome, vinculo, login_tt, login_tr, area, situacao, ano_mes, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
         ON CONFLICT (segmento, login_tt, ano_mes) DO UPDATE SET
           nome = EXCLUDED.nome,
           vinculo = EXCLUDED.vinculo,
           login_tr = EXCLUDED.login_tr,
           area = EXCLUDED.area,
           situacao = EXCLUDED.situacao,
           atualizado_em = now()`,
        [
          id,
          "neutra",
          e.nome,
          vinculo,
          e.tt || `nome:${e.nome}`,
          e.tr || "",
          e.area || "",
          e.situacao || "",
          nowYm,
        ],
      );
      contagens.tecnicos += 1;

      if (vinculo) {
        await sql(
          `INSERT INTO tecnico_vinculo_hist
             (id, tecnico_ref, segmento, vinculo, vigente_de, vigente_ate, ano_mes)
           VALUES ($1,$2,$3,$4,$5::date,NULL,$6)
           ON CONFLICT (segmento, tecnico_ref, vigente_de) DO UPDATE SET
             vinculo = EXCLUDED.vinculo,
             atualizado_em = now()`,
          [
            crypto.randomUUID(),
            e.tt || e.nome,
            "neutra",
            vinculo,
            `${nowYm}-01`,
            nowYm,
          ],
        );
      }
    }

    const { regs } = parseBaseNeutraRegs(merged.rows, equipe);
    const chunk = 80;
    for (let i = 0; i < regs.length; i += chunk) {
      const slice = regs.slice(i, i + chunk);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let p = 1;
      for (const r of slice) {
        const ym = `${r.dt.y}-${pad(r.dt.m)}`;
        placeholders.push(
          `($${p++},'neutra',$${p++},$${p++}::date,$${p++},$${p++},$${p++},$${p++},$${p++}::jsonb,$${p++},'sheets',now())`,
        );
        values.push(
          crypto.randomUUID(),
          r.sa,
          r.dt.key,
          r.estado,
          r.macro,
          r.tt,
          r.nome,
          JSON.stringify({
            drop: r.drop,
            meshEquip: r.meshEquip,
            area: r.area,
            tempoMin: r.tempoMin,
          }),
          ym,
        );
      }
      await sql(
        `INSERT INTO atividades
           (id, segmento, numero_sa, data_exec, estado, macro, tecnico_login, tecnico_nome, payload, ano_mes, fonte, atualizado_em)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (segmento, numero_sa) DO UPDATE SET
           data_exec = EXCLUDED.data_exec,
           estado = EXCLUDED.estado,
           macro = EXCLUDED.macro,
           tecnico_login = EXCLUDED.tecnico_login,
           tecnico_nome = EXCLUDED.tecnico_nome,
           payload = EXCLUDED.payload,
           ano_mes = EXCLUDED.ano_mes,
           atualizado_em = now()`,
        values,
      );
      contagens.atividades_neutra += slice.length;
    }

    const meses = listMesesNeutra(regs);
    const fechar = new Set(mesesParaFechar());
    for (const ym of meses) {
      const monthRegs = regs.filter(
        (r) => `${r.dt.y}-${pad(r.dt.m)}` === ym,
      );
      const prod = monthRegs.filter((r) => r.estado === "produtiva").length;
      const improd = monthRegs.filter((r) => r.estado === "improdutiva").length;
      const fechado = fechar.has(ym);
      if (fechado) mesesFechados.push(ym);
      await sql(
        `INSERT INTO snapshots_mensais
           (id, segmento, ano_mes, fechado, payload, atualizado_em)
         VALUES ($1,'neutra',$2,$3,$4::jsonb,now())
         ON CONFLICT (segmento, ano_mes) DO UPDATE SET
           fechado = EXCLUDED.fechado OR snapshots_mensais.fechado,
           payload = EXCLUDED.payload,
           atualizado_em = now()`,
        [
          crypto.randomUUID(),
          ym,
          fechado,
          JSON.stringify({
            produtivas: prod,
            improdutivas: improd,
            concluidas: prod + improd,
            fontes: merged.fontes,
          }),
        ],
      );
      contagens.snapshots_mensais += 1;
    }

    const result: BancoSyncResult = {
      ok: true,
      trigger,
      status: "ok",
      mensagem: `Sync Neutra: ${contagens.atividades_neutra} SA · ${contagens.tecnicos} técnicos · hist=${histPresente ? "sim" : "não"}`,
      contagens,
      meses_fechados: [...new Set(mesesFechados)].sort(),
      hist_presente: histPresente,
    };
    await sql(
      `UPDATE sync_runs SET finished_at = now(), status = $2, detalhe = $3::jsonb WHERE id = $1`,
      [runId, "ok", JSON.stringify(result)],
    );
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const result: BancoSyncResult = {
      ok: false,
      trigger,
      status: "error",
      mensagem: msg,
      contagens,
      meses_fechados: mesesFechados,
      hist_presente: histPresente,
    };
    await sql(
      `UPDATE sync_runs SET finished_at = now(), status = $2, detalhe = $3::jsonb WHERE id = $1`,
      [runId, "error", JSON.stringify(result)],
    );
    return result;
  }
}
