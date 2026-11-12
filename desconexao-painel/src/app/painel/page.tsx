"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PainelPayload } from "../../lib/types";

function currentMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctLabel(n: number): string {
  const v = n <= 1 ? n * 100 : n;
  return `${(Math.round(v * 10) / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: v % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function monthLabel(mes: string): string {
  if (mes.trim().toUpperCase() === "TOTAL") return "TOTAL · período completo";
  const [y, m] = mes.split("-");
  const names = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${names[Number(m)] || m} ${y}`;
}

function monthKeyFromMes(mes: string): string | null {
  if (mes.trim().toUpperCase() === "TOTAL") return null;
  const m = Number(mes.split("-")[1]);
  const keys = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  return keys[m - 1] || null;
}

const MES_OPTIONS: Array<[string, string]> = [
  ["TOTAL", "TOTAL"],
  ["2025-01", "Jan/2025"],
  ["2025-02", "Fev/2025"],
  ["2025-03", "Mar/2025"],
  ["2025-04", "Abr/2025"],
  ["2025-05", "Mai/2025"],
  ["2025-06", "Jun/2025"],
  ["2025-07", "Jul/2025"],
  ["2025-08", "Ago/2025"],
  ["2025-09", "Set/2025"],
  ["2025-10", "Out/2025"],
  ["2025-11", "Nov/2025"],
  ["2025-12", "Dez/2025"],
  ["2026-01", "Jan/2026"],
  ["2026-02", "Fev/2026"],
  ["2026-03", "Mar/2026"],
  ["2026-04", "Abr/2026"],
  ["2026-05", "Mai/2026"],
  ["2026-06", "Jun/2026"],
  ["2026-07", "Jul/2026"],
  ["2026-08", "Ago/2026"],
  ["2026-09", "Set/2026"],
  ["2026-10", "Out/2026"],
  ["2026-11", "Nov/2026"],
  ["2026-12", "Dez/2026"],
];

export default function PainelPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [mes, setMes] = useState(currentMes());
  const [data, setData] = useState<PainelPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesQ = params.get("mes")?.trim();
    if (mesQ) setMes(mesQ);
    if (params.has("token")) {
      params.delete("token");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const load = useCallback(async (m: string, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ mes: m });
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/painel?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (res.status === 401) setAuthed(false);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as PainelPayload;
      setData(json);
      setAuthed(true);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        setAuthed(res.ok);
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authed && !checking) void load(mes, true);
  }, [authed, checking, mes, load]);

  const saveToken = async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setTokenInput("");
      setAuthed(true);
      await load(mes);
    } catch (e) {
      setAuthed(false);
      setError(e instanceof Error ? e.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sync?mes=${encodeURIComponent(mes)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `Sync HTTP ${res.status}`);
      }
      await load(mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no sync");
      setLoading(false);
    }
  };

  const bannerClass = useMemo(() => {
    if (error) return "live-banner error";
    if (data?.status === "aguardando_credencial_sheets") return "live-banner wait";
    return "live-banner";
  }, [data, error]);

  const bannerText = useMemo(() => {
    if (error) return `Erro · ${error}`;
    if (!data) return "AO VIVO · carregando…";
    if (data.status === "aguardando_credencial_sheets") {
      return "AO VIVO · T.ESTRATÉGICO · aguardando credencial Sheets (amostra)";
    }
    return "AO VIVO · T.ESTRATÉGICO · Desconexão operacional";
  }, [data, error]);

  if (checking) {
    return (
      <div className="painel-page">
        <div className="demo-banner" role="status">
          Verificando sessão…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="painel-page">
        <div className="demo-banner" role="status">
          Link privado · informe o token de acesso
        </div>
        <div className="token-gate">
          <h1>DESCONEXÃO</h1>
          <p>
            Painel de <strong>T.ESTRATÉGICO</strong>. Cole o token do secret{" "}
            <code>PAINEL_API_TOKEN</code>.
          </p>
          {error ? <p style={{ color: "var(--accent)" }}>{error}</p> : null}
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Token de acesso"
            aria-label="Token de acesso"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveToken();
            }}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void saveToken()}
            disabled={loading}
          >
            Entrar no painel
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const colunas = data?.grade_tecnicos.colunas || [];
  const dias = data?.grade_tecnicos.dias || [];
  const totaisGrade = data?.grade_tecnicos.totais || [];
  const cidadeMeses = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ] as const;
  const highlightKey = monthKeyFromMes(mes);
  const isTotal = mes.trim().toUpperCase() === "TOTAL";
  const evoByMes = new Map(
    (data?.evolucao_mensal || []).map((d) => [d.mes, d.recolhas]),
  );
  const evoJanDez = cidadeMeses.map((m) => ({
    mes: m,
    recolhas: evoByMes.get(m) ?? 0,
  }));
  const maxEvo = Math.max(1, ...evoJanDez.map((d) => d.recolhas));
  const tipos = data?.por_tipo_servico || [];
  const maxTipo = Math.max(1, ...tipos.map((t) => t.quantidade));
  const ranking = data?.ranking_tecnicos || [];
  const maxRank = Math.max(1, ...ranking.map((r) => r.volume));

  return (
    <div className="painel-page painel-ops">
      <div className={bannerClass} role="status">
        {bannerText}
      </div>

      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Desconexão</strong> · operacional
            </span>
            {data?.fonte ? (
              <span className="status-pill">{data.fonte}</span>
            ) : null}
          </div>
          <div className="painel-controls">
            <label className="field-month">
              Visão
              <select
                aria-label="Selecionar mês ou TOTAL"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              >
                {MES_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => void load(mes, true)}
              disabled={loading}
            >
              Atualizar
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => void syncNow()}
              disabled={loading}
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
              <p className="ops-kicker">Leitura só · aba PAINEL</p>
              <h1 className="ops-title">{monthLabel(mes)}</h1>
              <p className="ops-sub">
                {data?.painel_atualizado ||
                  "Números oficiais da planilha · sem recalcular"}
              </p>
            </div>
            {data?.nota_auditoria ? (
              <p className="ops-note" role="note">
                {data.nota_auditoria}
              </p>
            ) : null}
          </div>

          {data?.mensagem ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.mensagem}
            </p>
          ) : null}

          <section className="kpi-grid kpi-grid-ops" aria-label="Indicadores">
            <article className="kpi kpi-hero reveal">
              <div className="kpi-label">
                {isTotal ? "Equip. recolhidos" : "Recolhas do mês"}
              </div>
              <div className="kpi-value">{kpis?.recolhidos ?? "—"}</div>
              <div className="kpi-hint">
                {isTotal ? "PAINEL · cabeçalho" : "PAINEL · cidade/evolução"}
              </div>
            </article>
            <article
              className={`kpi reveal reveal-delay-1 ${kpis?.escopo === "mes" ? "kpi-muted" : ""}`}
            >
              <div className="kpi-label">Entregues</div>
              <div className="kpi-value">
                {kpis?.escopo === "cabecalho" ? (kpis.entregues ?? "—") : "—"}
              </div>
              <div className="kpi-hint">
                {kpis?.escopo === "cabecalho"
                  ? "PAINEL · cabeçalho"
                  : "Só no TOTAL (célula do cabeçalho)"}
              </div>
            </article>
            <article
              className={`kpi reveal reveal-delay-2 ${kpis?.escopo === "mes" ? "kpi-muted" : ""}`}
            >
              <div className="kpi-label">Em processo</div>
              <div className="kpi-value">
                {kpis?.escopo === "cabecalho" ? (kpis.em_processo ?? "—") : "—"}
              </div>
              <div className="kpi-hint">
                {kpis?.escopo === "cabecalho"
                  ? "PAINEL · cabeçalho"
                  : "Só no TOTAL (célula do cabeçalho)"}
              </div>
            </article>
            <article
              className={`kpi reveal reveal-delay-3 ${kpis?.escopo === "mes" ? "kpi-muted" : ""}`}
            >
              <div className="kpi-label">% Entregue</div>
              <div className="kpi-value">
                {kpis?.escopo === "cabecalho" && kpis
                  ? pctLabel(kpis.pct_entregue)
                  : "—"}
              </div>
              <div className="kpi-hint">
                {kpis?.escopo === "cabecalho"
                  ? "PAINEL · cabeçalho"
                  : "Só no TOTAL (célula do cabeçalho)"}
              </div>
            </article>
          </section>

          <section className="painel-block" aria-labelledby="rank-title">
            <div className="painel-block-head">
              <h2 id="rank-title">Ranking técnicos</h2>
              <span>
                {isTotal
                  ? "TOT da grade do mês na planilha (referência)"
                  : "Volume no mês · coluna TOT / soma dias"}
              </span>
            </div>
            <div className="rank-list">
              {ranking.length === 0 ? (
                <p className="painel-foot" style={{ padding: "1rem" }}>
                  Sem ranking para {monthLabel(mes)}.
                </p>
              ) : (
                ranking.map((r, i) => (
                  <div className="rank-row" key={r.codigo}>
                    <span className="rank-pos">{i + 1}</span>
                    <div className="rank-meta">
                      <strong>{r.nome}</strong>
                      <span className="sub">{r.codigo}</span>
                    </div>
                    <div className="rank-bar-track">
                      <div
                        className="rank-bar"
                        style={{
                          width: `${Math.max(4, Math.round((r.volume / maxRank) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="rank-vol">{r.volume}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="painel-block" aria-labelledby="servico-title">
            <div className="painel-block-head">
              <h2 id="servico-title">Por tipo de serviço</h2>
              <span>
                {isTotal
                  ? "PAINEL · TOTAL desde AGO/2026"
                  : `PAINEL · linha ${monthLabel(mes)}`}
                {typeof data?.tipos_total === "number"
                  ? ` · soma ${data.tipos_total}`
                  : ""}
              </span>
            </div>
            <div className="tipo-ops">
              {(tipos.length
                ? tipos
                : [{ tipo: "—", quantidade: 0 }]
              ).map((t) => (
                <article className="tipo-card" key={t.tipo}>
                  <div className="kpi-label">{t.tipo}</div>
                  <div className="kpi-value">{t.quantidade}</div>
                  <div className="tipo-meter">
                    <span
                      style={{
                        width: `${Math.max(3, Math.round((t.quantidade / maxTipo) * 100))}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="painel-block" aria-labelledby="grade-title">
            <div className="painel-block-head">
              <h2 id="grade-title">Grade POR DIA</h2>
              <span>
                {monthLabel(mes)}
                {data?.grade_tecnicos.fonte_grade
                  ? ` · ${data.grade_tecnicos.fonte_grade}`
                  : ""}
              </span>
            </div>
            <div className="table-wrap">
              {dias.length === 0 ? (
                <p className="painel-foot" style={{ padding: "1rem" }}>
                  {isTotal
                    ? "No TOTAL não há grade dia×técnico — escolha um mês. Ranking acima usa TOT da grade do mês atual na planilha."
                    : `Sem grade dia × técnico no PAINEL para ${monthLabel(mes)}.`}
                </p>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      {colunas.map((c) => (
                        <th key={c.codigo}>
                          {c.nome}
                          <span className="sub">{c.codigo}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((row) => {
                      const [day, ...counts] = row;
                      return (
                        <tr key={day}>
                          <td>{String(day).padStart(2, "0")}</td>
                          {counts.map((n, i) => (
                            <td
                              key={`${day}-${i}`}
                              className={n > 0 ? "cell-hot" : undefined}
                            >
                              {n}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOT</td>
                      {colunas.map((_, i) => (
                        <td key={`t-${i}`}>
                          {totaisGrade[i] ??
                            dias.reduce((acc, row) => acc + (row[i + 1] || 0), 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </section>

          <section className="painel-block" aria-labelledby="cidade-title">
            <div className="painel-block-head">
              <h2 id="cidade-title">Recolhas por cidade × mês</h2>
              <span>
                {highlightKey
                  ? `destaque ${highlightKey}`
                  : "matriz completa · TOTAL = período"}
              </span>
            </div>
            <div className="table-wrap table-wrap-cidade">
              <table className="data compact cidade-mes">
                <thead>
                  <tr>
                    <th>Cidade</th>
                    {cidadeMeses.map((m) => (
                      <th
                        key={m}
                        className={m === highlightKey ? "col-focus" : undefined}
                      >
                        {m}
                      </th>
                    ))}
                    <th className={isTotal ? "col-focus" : undefined}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.por_cidade_mes || []).map((c) => (
                    <tr key={c.cidade}>
                      <td>{c.cidade}</td>
                      {cidadeMeses.map((m) => (
                        <td
                          key={m}
                          className={m === highlightKey ? "col-focus" : undefined}
                        >
                          {c.meses[m] ?? 0}
                        </td>
                      ))}
                      <td className={isTotal ? "col-focus" : undefined}>
                        {c.total ||
                          cidadeMeses.reduce(
                            (s, m) => s + (c.meses[m] ?? 0),
                            0,
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL</td>
                    {cidadeMeses.map((m) => (
                      <td
                        key={`t-${m}`}
                        className={m === highlightKey ? "col-focus" : undefined}
                      >
                        {(data?.por_cidade_mes || []).reduce(
                          (s, c) => s + (c.meses[m] ?? 0),
                          0,
                        )}
                      </td>
                    ))}
                    <td className={isTotal ? "col-focus" : undefined}>
                      {(data?.por_cidade_mes || []).reduce(
                        (s, c) =>
                          s +
                          (c.total ||
                            cidadeMeses.reduce(
                              (a, m) => a + (c.meses[m] ?? 0),
                              0,
                            )),
                        0,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="painel-block" aria-labelledby="evo-title">
            <div className="painel-block-head">
              <h2 id="evo-title">Evolução mensal</h2>
              <span>Recolhas · JAN–DEZ</span>
            </div>
            <div className="chart chart-full" aria-label="Gráfico de barras">
              <div className="chart-plot chart-plot-12">
                {evoJanDez.map((d, i) => {
                  const h = Math.max(
                    8,
                    Math.round((d.recolhas / maxEvo) * 100),
                  );
                  const focus = d.mes === highlightKey;
                  return (
                    <div
                      className={`chart-col ${focus ? "chart-col-focus" : ""}`}
                      key={d.mes}
                    >
                      <div className="chart-bar-wrap">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${h}%`,
                            animationDelay: `${0.08 + i * 0.05}s`,
                          }}
                        >
                          <span className="chart-bar-value">{d.recolhas}</span>
                        </div>
                      </div>
                      <span className="chart-label">{d.mes}</span>
                    </div>
                  );
                })}
              </div>
              <p className="chart-legend">Fonte: PAINEL · RECOLHAS POR CIDADE (soma)</p>
            </div>
          </section>

          <div className="painel-foot">
            <p>
              Etapa 1 · Desconexão · atualizado{" "}
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
