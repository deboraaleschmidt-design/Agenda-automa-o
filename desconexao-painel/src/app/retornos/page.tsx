"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import PeriodoVisaoSelector from "../../components/PeriodoVisaoSelector";
import { downloadCsv, rowsToCsv } from "../../lib/export-csv";
import { labelPeriodo, ymFromBrDate, ymMatchesPeriodo } from "../../lib/periodo";
import type { RetornoLinha, RetornosPayload } from "../../lib/retornos-parse";

const FALLBACK_MESES = ["2026-09", "2026-10", "2026-11"];

function filterByMes(lines: RetornoLinha[], mes: string): RetornoLinha[] {
  return lines.filter((l) => {
    const ym = ymFromBrDate(l.data_retorno);
    if (!ym) return mes.trim().toUpperCase() === "TOTAL";
    return ymMatchesPeriodo(ym, mes);
  });
}

function RetornosInner() {
  const [data, setData] = useState<RetornosPayload | null>(null);
  const [mes, setMes] = useState("TOTAL");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqSeq = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesQ = params.get("mes")?.trim();
    if (mesQ) setMes(mesQ);
    setReady(true);
  }, []);

  const load = useCallback(async (refresh = false) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/retornos?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as RetornosPayload;
      if (seq !== reqSeq.current) return;
      setData(payload);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setData(null);
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("mes") !== mes) {
      url.searchParams.set("mes", mes);
      window.history.replaceState({}, "", url.toString());
    }
    void load(true);
  }, [load, mes, ready]);

  const com = useMemo(
    () => filterByMes(data?.com_historico || [], mes),
    [data, mes],
  );
  const sem = useMemo(
    () => filterByMes(data?.sem_historico || [], mes),
    [data, mes],
  );
  const isTotal = mes.trim().toUpperCase() === "TOTAL";
  const r = data?.resumo;

  return (
    <div className="painel-page painel-ops">
      <div
        className={data?.fonte === "sheets" ? "live-banner" : "demo-banner"}
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Retornos"
          : data?.mensagem || "Aguardando Sheets / D-1"}
      </div>
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Retornos</strong>
            </span>
            <span className="status-pill">D-1</span>
            {data?.fonte ? (
              <span className="status-pill">{data.fonte}</span>
            ) : null}
            <a className="btn btn-ghost btn-sm" href="/">
              ← Segmentos
            </a>
          </div>
          <div className="painel-controls">
            <PeriodoVisaoSelector
              value={mes}
              mesesDisponiveis={data?.meses_disponiveis || FALLBACK_MESES}
              fallbackMeses={FALLBACK_MESES}
              onChange={setMes}
            />
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={!data}
              onClick={() => {
                const lines = [...com, ...sem];
                const csv = rowsToCsv(
                  [
                    "contrato",
                    "n_retorno",
                    "data_pai",
                    "tecnico_pai",
                    "data_retorno",
                    "atendimento",
                    "tecnico_atendeu",
                    "fechamento",
                    "grupo",
                  ],
                  lines.map((l) => [
                    l.contrato,
                    l.n_retorno,
                    l.data_pai,
                    l.tecnico_pai,
                    l.data_retorno,
                    l.data_hora_atendimento,
                    l.tecnico_atendeu,
                    l.fechamento,
                    l.grupo,
                  ]),
                );
                downloadCsv(`retornos-${mes}.csv`, csv);
              }}
            >
              Exportar CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={loading}
              onClick={() => void load(true)}
            >
              Sincronizar
            </button>
          </div>
        </div>
      </header>

      <main className="painel-main">
        <div className="container">
          <div className="ops-lead reveal">
            <div>
              <p className="ops-kicker">
                Leitura só · substitui Retorno Credenciada
              </p>
              <h1 className="ops-title">{labelPeriodo(mes)}</h1>
              <p className="ops-sub">{data?.titulo || "—"}</p>
            </div>
          </div>

          {error ? <p className="banner-error">{error}</p> : null}
          {data?.periodo_nota ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.periodo_nota}
            </p>
          ) : null}

          <section className="kpi-grid kpi-grid-ops" aria-label="Resumo retornos">
            <article className="kpi kpi-hero reveal">
              <div className="kpi-label">Retornos</div>
              <div className="kpi-value">
                {isTotal ? r?.total_retornos ?? "—" : com.length + sem.length}
              </div>
            </article>
            <article className="kpi reveal">
              <div className="kpi-label">Contratos</div>
              <div className="kpi-value">
                {isTotal
                  ? r?.contratos ?? "—"
                  : new Set([...com, ...sem].map((l) => l.contrato)).size}
              </div>
            </article>
            <article className="kpi reveal">
              <div className="kpi-label">Com histórico TCI</div>
              <div className="kpi-value">
                {isTotal ? r?.com_historico ?? "—" : com.length}
              </div>
            </article>
            <article className="kpi reveal">
              <div className="kpi-label">Sem histórico TCI</div>
              <div className="kpi-value">
                {isTotal ? r?.sem_historico ?? "—" : sem.length}
              </div>
            </article>
          </section>

          {isTotal && r?.texto ? (
            <p className="ops-note" style={{ marginBottom: "1rem" }}>
              {r.texto}
            </p>
          ) : null}

          <section className="painel-block" aria-labelledby="ofensor-title">
            <div className="painel-block-head">
              <h2 id="ofensor-title">Ofensor (resumo)</h2>
              <span>fechamento · técnico do pai · quem atendeu</span>
            </div>
            <div className="retornos-ofensor-grid">
              <OfensorTable
                title="Fechamento do retorno"
                rows={data?.ofensor_fechamento || []}
              />
              <OfensorTable
                title="Técnico do pai"
                rows={data?.ofensor_pai || []}
              />
              <OfensorTable
                title="Técnico que atendeu"
                rows={data?.ofensor_atendeu || []}
              />
            </div>
          </section>

          <DetalheBlock
            id="com-hist"
            title={`COM HISTÓRICO TCI · ${com.length} retornos`}
            lines={com}
          />
          <DetalheBlock
            id="sem-hist"
            title={`SEM HISTÓRICO TCI · ${sem.length} retornos`}
            lines={sem}
          />

          <div className="painel-foot">
            <p>
              Retornos · atualizado{" "}
              {data?.atualizado_em
                ? new Date(data.atualizado_em).toLocaleString("pt-BR")
                : "—"}
            </p>
            <a href="/">← Segmentos</a>
          </div>
        </div>
      </main>
    </div>
  );
}

function OfensorTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; retornos: number }>;
}) {
  return (
    <div>
      <div className="painel-block-head" style={{ marginTop: 0 }}>
        <h2>{title}</h2>
      </div>
      <div className="table-wrap">
        <table className="data compact">
          <thead>
            <tr>
              <th>Item</th>
              <th>Retornos</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2}>—</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.retornos}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalheBlock({
  id,
  title,
  lines,
}: {
  id: string;
  title: string;
  lines: RetornoLinha[];
}) {
  return (
    <section className="painel-block" aria-labelledby={id}>
      <div className="painel-block-head">
        <h2 id={id}>{title}</h2>
        <span>1 linha por retorno</span>
      </div>
      <div className="table-wrap table-wrap-wide">
        <table className="data compact">
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Nº</th>
              <th>Data pai</th>
              <th>Técnico pai</th>
              <th>Códigos / fech. pai</th>
              <th>Data retorno</th>
              <th>Atendimento</th>
              <th>Quem atendeu</th>
              <th>Fechamento</th>
              <th>Motivo</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={11}>Nenhuma linha</td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={`${l.contrato}-${l.n_retorno}-${i}`}>
                  <td>{l.contrato}</td>
                  <td>{l.n_retorno}</td>
                  <td>{l.data_pai}</td>
                  <td>{l.tecnico_pai}</td>
                  <td>
                    {l.pai_codigos}
                    {l.pai_fechamento ? ` · ${l.pai_fechamento}` : ""}
                  </td>
                  <td>{l.data_retorno}</td>
                  <td>{l.data_hora_atendimento}</td>
                  <td>{l.tecnico_atendeu}</td>
                  <td>{l.fechamento}</td>
                  <td>{l.motivo || "—"}</td>
                  <td>{l.observacao || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RetornosPage() {
  return (
    <AuthGate>
      <RetornosInner />
    </AuthGate>
  );
}
