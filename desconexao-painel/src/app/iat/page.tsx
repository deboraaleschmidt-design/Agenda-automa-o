"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import {
  filterIatBlocks,
  type IatBase,
  type IatPayload,
} from "../../lib/iat-parse";

function pct(n: number): string {
  return `${(Math.round(n * 1000) / 10).toLocaleString("pt-BR")}%`;
}

function IatInner() {
  const [data, setData] = useState<IatPayload | null>(null);
  const [base, setBase] = useState<IatBase>("TOTAL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/iat${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setData((await res.json()) as IatPayload);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const blocos = useMemo(
    () => filterIatBlocks(data?.blocos || [], base),
    [data, base],
  );
  const resumo = (data?.resumo || []).find((r) =>
    base === "TOTAL"
      ? r.base === "TOTAL"
      : r.base === base || (base === "PORTO ALEGRE" && r.base.includes("PORTO")),
  );

  return (
    <div className="painel-page">
      <div
        className={
          data?.fonte === "sheets" ? "live-banner" : "demo-banner"
        }
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · IAT"
          : data?.mensagem || "Aguardando Sheets / D-1"}
      </div>
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>IAT</strong>
            </span>
            <span className="status-pill">D-1</span>
          </div>
          <div className="painel-controls">
            <label className="field-month">
              Base
              <select
                aria-label="Filtrar base"
                value={base}
                onChange={(e) => setBase(e.target.value as IatBase)}
              >
                <option value="TOTAL">Total</option>
                <option value="CANOAS">Canoas</option>
                <option value="PORTO ALEGRE">Porto Alegre</option>
              </select>
            </label>
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
          {error ? <p className="banner-error">{error}</p> : null}
          <p className="painel-foot" style={{ marginBottom: "1rem" }}>
            {data?.titulo || "—"}
          </p>
          <section className="kpi-grid">
            <article className="kpi">
              <div className="kpi-label">Produtivas</div>
              <div className="kpi-value">{resumo?.produtivas ?? "—"}</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">Improdutivas</div>
              <div className="kpi-value">{resumo?.improdutivas ?? "—"}</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">% Produtivas</div>
              <div className="kpi-value">
                {resumo ? pct(resumo.pct_produtivas) : "—"}
              </div>
            </article>
          </section>

          {blocos.map((b) => (
            <section
              className="painel-block"
              key={`${b.kind}-${b.base}`}
            >
              <div className="painel-block-head">
                <h2>
                  {b.kind === "produtivas" ? "Produtivas" : "Improdutivas"} ·{" "}
                  {b.base}
                </h2>
                <span>dia × técnico</span>
              </div>
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Técnico</th>
                      {b.diasHeader.map((d) => (
                        <th key={d}>{d}</th>
                      ))}
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.tecnicos.map((t) => (
                      <tr key={t.tecnico}>
                        <td>{t.tecnico}</td>
                        {b.diasHeader.map((_, i) => (
                          <td key={`${t.tecnico}-${i}`}>
                            {t.dias[i] ?? 0}
                          </td>
                        ))}
                        <td>{t.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <div className="painel-foot">
            <p>
              MVP IAT · atualizado{" "}
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

export default function IatPage() {
  return (
    <AuthGate>
      <IatInner />
    </AuthGate>
  );
}
