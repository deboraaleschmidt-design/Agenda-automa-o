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
  if (mes.trim().toUpperCase() === "TOTAL") return "TOTAL (desde ago/2026)";
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
    // Strip any legacy ?token= from the URL without reading it into storage.
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
        if (res.status === 401) {
          setAuthed(false);
        }
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
        if (res.ok) {
          setAuthed(true);
        } else {
          setAuthed(false);
        }
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
    if (authed && !checking) void load(mes);
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
    return "AO VIVO · T.ESTRATÉGICO · dados da operação";
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
            <code>PAINEL_API_TOKEN</code>. Em desenvolvimento local, use{" "}
            <code>dev-local-token</code> quando o secret não estiver definido.
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
  const evo = data?.evolucao_mensal || [];
  const maxEvo = Math.max(1, ...evo.map((d) => d.recolhas));
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
  const tipos = data?.por_tipo_servico || [];

  return (
    <div className="painel-page">
      <div className={bannerClass} role="status">
        {bannerText}
      </div>

      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              DESCONEXÃO
            </a>
            <span className="empresa">
              <strong>T.ESTRATÉGICO</strong>
            </span>
            {data?.fonte ? (
              <span className="status-pill">{data.fonte}</span>
            ) : null}
          </div>
          <div className="painel-controls">
            <label className="field-month">
              Mês
              <select
                aria-label="Selecionar mês"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              >
                {[
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
                ].map(([value, label]) => (
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
          {data?.mensagem ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.mensagem}
            </p>
          ) : null}

          <section className="kpi-grid" aria-label="Indicadores do mês">
            <article className="kpi reveal">
              <div className="kpi-label">Equip. recolhidos</div>
              <div className="kpi-value">{kpis?.recolhidos ?? "—"}</div>
            </article>
            <article className="kpi reveal reveal-delay-1">
              <div className="kpi-label">Entregues</div>
              <div className="kpi-value">{kpis?.entregues ?? "—"}</div>
            </article>
            <article className="kpi reveal reveal-delay-2">
              <div className="kpi-label">Em processo</div>
              <div className="kpi-value">{kpis?.em_processo ?? "—"}</div>
            </article>
            <article className="kpi reveal reveal-delay-3">
              <div className="kpi-label">% Entregue</div>
              <div className="kpi-value">
                {kpis ? pctLabel(kpis.pct_entregue) : "—"}
              </div>
            </article>
          </section>

          <section className="painel-block" aria-labelledby="servico-title">
            <div className="painel-block-head">
              <h2 id="servico-title">Por tipo de serviço</h2>
              <span>
                {monthLabel(mes)} · Respostas col. SERVIÇO
              </span>
            </div>
            <div style={{ padding: "1rem" }}>
              <div className="servico-grid" aria-label="Contagem por tipo">
                {(tipos.length
                  ? tipos
                  : [
                      { tipo: "DESCONEXÃO", quantidade: 0 },
                      { tipo: "RETIRADA", quantidade: 0 },
                      { tipo: "INSTALAÇÃO", quantidade: 0 },
                      { tipo: "TROCA PACOTE/TECNOLOGIA", quantidade: 0 },
                    ]
                ).map((t, i) => (
                  <article
                    className={`servico-card reveal reveal-delay-${Math.min(i, 3)}`}
                    key={t.tipo}
                  >
                    <div className="kpi-label">{t.tipo}</div>
                    <div className="kpi-value">{t.quantidade}</div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="painel-block" aria-labelledby="grade-title">
            <div className="painel-block-head">
              <h2 id="grade-title">Grade por técnico</h2>
              <span>{monthLabel(mes)} · dia × técnico</span>
            </div>
            <div className="table-wrap">
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
                          <td key={`${day}-${i}`}>{n}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL</td>
                    {colunas.map((_, i) => {
                      const sum = dias.reduce(
                        (acc, row) => acc + (row[i + 1] || 0),
                        0,
                      );
                      return <td key={`t-${i}`}>{sum}</td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="split-row">
            <section className="painel-block" aria-labelledby="cidade-title">
              <div className="painel-block-head">
                <h2 id="cidade-title">Por cidade × mês</h2>
                <span>Recolhas</span>
              </div>
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Cidade</th>
                      {cidadeMeses.map((m) => (
                        <th key={m}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.por_cidade_mes || []).map((c) => (
                      <tr key={c.cidade}>
                        <td>{c.cidade}</td>
                        {cidadeMeses.map((m) => (
                          <td key={m}>{c.meses[m] ?? 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="painel-block" aria-labelledby="evo-title">
              <div className="painel-block-head">
                <h2 id="evo-title">Evolução mensal</h2>
                <span>Recolhas</span>
              </div>
              <div className="chart" aria-label="Gráfico de barras">
                <div className="chart-plot">
                  {evo.map((d, i) => {
                    const h = Math.max(
                      8,
                      Math.round((d.recolhas / maxEvo) * 100),
                    );
                    return (
                      <div className="chart-col" key={`${d.mes}-${i}`}>
                        <div className="chart-bar-wrap">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${h}%`,
                              animationDelay: `${0.08 + i * 0.08}s`,
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
                <p className="chart-legend">MÊS / RECOLHAS</p>
              </div>
            </section>
          </div>

          <div className="painel-foot">
            <p>
              Slice 1 · API + Postgres · atualizado{" "}
              {data?.atualizado_em
                ? new Date(data.atualizado_em).toLocaleString("pt-BR")
                : "—"}
            </p>
            <a href="/">← Início</a>
          </div>
        </div>
      </main>
    </div>
  );
}
