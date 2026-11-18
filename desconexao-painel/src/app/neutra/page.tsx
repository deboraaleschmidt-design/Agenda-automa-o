"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import PeriodoVisaoSelector from "../../components/PeriodoVisaoSelector";
import type {
  NeutraPayload,
  NeutraVisaoDiaRow,
} from "../../lib/neutra-parse";
import { labelPeriodo } from "../../lib/periodo";

function pct(n: number): string {
  return `${(Math.round(n * 1000) / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function num1(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const FALLBACK_MESES = ["2026-09", "2026-10", "2026-11"];

function monthLabel(mes: string): string {
  if (mes.trim().toUpperCase() === "TOTAL") return "TOTAL · BASE NEUTRA";
  if (/^\d{4}$/.test(mes.trim())) return `TOTAL · ${mes.trim()}`;
  return labelPeriodo(mes);
}

function NeutraInner() {
  const [data, setData] = useState<NeutraPayload | null>(null);
  const [mes, setMes] = useState("2026-11");
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

  const load = useCallback(async (m: string, refresh = false) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ mes: m });
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/neutra?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as NeutraPayload;
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
    void load(mes, true);
  }, [load, mes, ready]);

  const r = data?.resumo;

  return (
    <div className="painel-page painel-ops">
      <div
        className={data?.fonte === "sheets" ? "live-banner" : "demo-banner"}
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Neutra"
          : data?.mensagem || "Aguardando Sheets / Neutra"}
      </div>
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Neutra</strong> · operacional
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
              className="btn btn-primary btn-sm"
              type="button"
              disabled={loading}
              onClick={() => void load(mes, true)}
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
                Leitura só · BASE NEUTRA + EQUIPE NEUTRA
                {data?.dados_ate_br
                  ? ` · dados até ${data.dados_ate_br}`
                  : ""}
              </p>
              <h1 className="ops-title">{monthLabel(mes)}</h1>
              <p className="ops-sub">{data?.titulo || "—"}</p>
            </div>
          </div>

          {error ? <p className="banner-error">{error}</p> : null}
          {data?.mensagem ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.mensagem}
            </p>
          ) : null}

          <section className="kpi-grid kpi-grid-ops" aria-label="Resumo Neutra">
            <article className="kpi reveal">
              <div className="kpi-label">Técnicos</div>
              <div className="kpi-value">{r?.tecnicos ?? "—"}</div>
              <div className="kpi-hint">com produção no período</div>
            </article>
            <article className="kpi kpi-hero reveal reveal-delay-1">
              <div className="kpi-label">Produtivas</div>
              <div className="kpi-value">{r?.produtivas ?? "—"}</div>
              <div className="kpi-hint">Concluído com sucesso</div>
            </article>
            <article className="kpi kpi-improd reveal reveal-delay-2">
              <div className="kpi-label">Improdutivas</div>
              <div className="kpi-value">{r?.improdutivas ?? "—"}</div>
              <div className="kpi-hint">Concluído sem sucesso</div>
            </article>
            <article className="kpi reveal reveal-delay-3">
              <div className="kpi-label">% Sucesso</div>
              <div className="kpi-value">
                {r ? pct(r.pct_sucesso) : "—"}
              </div>
              <div className="kpi-hint">prod ÷ (prod + improd)</div>
            </article>
            <article className="kpi reveal">
              <div className="kpi-label">Tempo médio</div>
              <div className="kpi-value">{r?.tempo_medio_label ?? "—"}</div>
              <div className="kpi-hint">Início→Fim · ignora ≥12h</div>
            </article>
            <article className="kpi reveal reveal-delay-1">
              <div className="kpi-label">% Reaprov. drop</div>
              <div className="kpi-value">
                {r ? pct(r.reaprov_pct) : "—"}
              </div>
              <div className="kpi-hint">
                {r ? `${r.reaprov_qtd} reaprov. ÷ produtivas` : "—"}
              </div>
            </article>
            <article className="kpi reveal reveal-delay-2">
              <div className="kpi-label">Dias com atividade</div>
              <div className="kpi-value">{r?.dias_atividade ?? "—"}</div>
              <div className="kpi-hint">dias distintos na base</div>
            </article>
          </section>

          {data?.visao_dia ? (
            <section
              className="painel-block"
              aria-labelledby="tab-neutra-dia"
            >
              <div className="painel-block-head">
                <h2 id="tab-neutra-dia">Visão por dia</h2>
                <span>
                  produtivas/dia · quinzenas ·{" "}
                  {data.visao_dia.rows.length} técnico(s)
                </span>
              </div>
              <div className="neutra-pay-legend" role="note">
                <p>
                  <strong>Pagamento só PJ</strong> ·{" "}
                  {data.visao_dia.pagamento.q1_referencia}: paga em{" "}
                  <strong>{data.visao_dia.pagamento.q1_pago_em}</strong>
                  {" · "}
                  {data.visao_dia.pagamento.q2_referencia}: paga em{" "}
                  <strong>{data.visao_dia.pagamento.q2_pago_em}</strong>
                </p>
                <p className="neutra-pay-rule">
                  {data.visao_dia.pagamento.regra}
                </p>
              </div>
              <div className="table-wrap neutra-dia-wrap">
                <table className="data compact neutra-dia-table">
                  <thead>
                    <tr>
                      <th className="neutra-dia-sticky">Técnico</th>
                      <th className="neutra-dia-tipo-col">Tipo</th>
                      {data.visao_dia.cols.map((c) => (
                        <th
                          key={c.key}
                          className={
                            c.fechamento
                              ? `neutra-fechamento neutra-fechamento-${c.fechamento}`
                              : undefined
                          }
                          title={
                            c.fechamento === "1a"
                              ? "Fechamento 1ª quinzena"
                              : c.fechamento === "2a"
                                ? "Fechamento 2ª quinzena"
                                : undefined
                          }
                        >
                          <span className="neutra-dia-num">{c.dia}</span>
                          <span className="neutra-dia-wd">{c.weekday}</span>
                          {c.fechamento === "1a" ? (
                            <span className="neutra-fechamento-label">
                              Fech. 1ª
                            </span>
                          ) : null}
                          {c.fechamento === "2a" ? (
                            <span className="neutra-fechamento-label">
                              Fech. 2ª
                            </span>
                          ) : null}
                        </th>
                      ))}
                      <th className="neutra-dia-sum">Total 1ª</th>
                      <th className="neutra-dia-sum">Total 2ª</th>
                      <th className="neutra-dia-sum">Total produtivas</th>
                      <th className="neutra-dia-sum neutra-dia-improd-h">
                        Total improdutivas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visao_dia.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + data.visao_dia.cols.length + 4}
                        >
                          Sem produção no mês.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {data.visao_dia.rows.map((row: NeutraVisaoDiaRow) => (
                          <tr key={row.tt || row.nome}>
                            <td
                              className="neutra-dia-sticky"
                              title={row.nome}
                            >
                              <span className="neutra-dia-nome">
                                {row.nome}
                              </span>
                            </td>
                            <td className="neutra-dia-tipo-col">
                              <span
                                className={
                                  row.is_pj
                                    ? "neutra-tipo neutra-tipo-pj"
                                    : "neutra-tipo neutra-tipo-clt"
                                }
                              >
                                {row.is_pj ? "PJ" : "CLT"}
                              </span>
                            </td>
                            {row.por_dia.map((n, i) => {
                              const col = data.visao_dia!.cols[i];
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    col.fechamento
                                      ? `neutra-fechamento neutra-fechamento-${col.fechamento}`
                                      : undefined
                                  }
                                >
                                  {n || ""}
                                </td>
                              );
                            })}
                            <td className="neutra-dia-sum">{row.q1}</td>
                            <td className="neutra-dia-sum">{row.q2}</td>
                            <td className="neutra-dia-sum">
                              {row.produtivas}
                            </td>
                            <td className="neutra-dia-sum cell-improd">
                              {row.improdutivas}
                            </td>
                          </tr>
                        ))}
                        <tr className="neutra-dia-total">
                          <td className="neutra-dia-sticky">
                            <span className="neutra-dia-nome">
                              {data.visao_dia.total.nome}
                            </span>
                          </td>
                          <td className="neutra-dia-tipo-col" />
                          {data.visao_dia.total.por_dia.map((n, i) => {
                            const col = data.visao_dia!.cols[i];
                            return (
                              <td
                                key={col.key}
                                className={
                                  col.fechamento
                                    ? `neutra-fechamento neutra-fechamento-${col.fechamento}`
                                    : undefined
                                }
                              >
                                {n || ""}
                              </td>
                            );
                          })}
                          <td className="neutra-dia-sum">
                            {data.visao_dia.total.q1}
                          </td>
                          <td className="neutra-dia-sum">
                            {data.visao_dia.total.q2}
                          </td>
                          <td className="neutra-dia-sum">
                            {data.visao_dia.total.produtivas}
                          </td>
                          <td className="neutra-dia-sum cell-improd">
                            {data.visao_dia.total.improdutivas}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="painel-block" aria-labelledby="tab-neutra">
            <div className="painel-block-head">
              <h2 id="tab-neutra">Produção por técnico</h2>
              <span>
                nome · TT · área · {(data?.tecnicos || []).length} linha(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>TT</th>
                    <th>Área</th>
                    <th>Produtivas</th>
                    <th>Improdutivas</th>
                    <th>% Sucesso</th>
                    <th>Tempo méd.</th>
                    <th>Reaprov. qtd</th>
                    <th>Reaprov. %</th>
                    <th>Dias</th>
                    <th>Méd. prod/dia</th>
                    <th>Méd. pend/dia</th>
                    <th>Méd. prod/sem</th>
                    <th>Méd. pend/sem</th>
                    <th>Méd. prod/mês</th>
                    <th>Méd. pend/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.tecnicos || []).length === 0 ? (
                    <tr>
                      <td colSpan={16}>Sem técnicos com produção no período.</td>
                    </tr>
                  ) : (
                    (data?.tecnicos || []).map((t) => (
                      <tr key={t.tt}>
                        <td>{t.nome}</td>
                        <td>{t.tt}</td>
                        <td>{t.area}</td>
                        <td>{t.produtivas}</td>
                        <td className="cell-improd">{t.improdutivas}</td>
                        <td>{pct(t.pct_sucesso)}</td>
                        <td>{t.tempo_medio_label}</td>
                        <td>{t.reaprov_qtd}</td>
                        <td>{pct(t.reaprov_pct)}</td>
                        <td>{t.dias_trab}</td>
                        <td>{num1(t.media_prod_dia)}</td>
                        <td className="cell-improd">
                          {num1(t.media_pend_dia)}
                        </td>
                        <td>{num1(t.media_prod_semana)}</td>
                        <td className="cell-improd">
                          {num1(t.media_pend_semana)}
                        </td>
                        <td>{num1(t.media_prod_mes)}</td>
                        <td className="cell-improd">
                          {num1(t.media_pend_mes)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {(data?.avisos || []).length ? (
            <section className="painel-block">
              <div className="painel-block-head">
                <h2>Notas</h2>
                <span>base / LPU</span>
              </div>
              <ul className="ops-note-list">
                {(data?.avisos || []).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="painel-foot">
            <p>
              Neutra · atualizado{" "}
              {data?.atualizado_em
                ? new Date(data.atualizado_em).toLocaleString("pt-BR")
                : "—"}
              {" · "}
              <a href="/financeiro?segmento=neutra&mes=2026-11">
                Financeiro Neutra
              </a>
            </p>
            <a href="/">← Segmentos</a>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NeutraPage() {
  return (
    <AuthGate>
      <NeutraInner />
    </AuthGate>
  );
}
