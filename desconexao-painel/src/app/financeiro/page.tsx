"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";
import type { FinancePayload } from "../../lib/finance-parse";

function moneyBr(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function FinanceiroInner() {
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/financeiro${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setData((await res.json()) as FinancePayload);
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

  return (
    <div className="painel-page">
      <div
        className={
          data?.fonte === "sheets" ? "live-banner" : "demo-banner"
        }
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Financeiro Desconexão"
          : data?.mensagem || "Aguardando Sheets"}
      </div>
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Financeiro</strong>
            </span>
            <span className="status-pill">Desconexão</span>
          </div>
          <div className="painel-controls">
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
          <section className="kpi-grid" aria-label="Totais">
            <article className="kpi">
              <div className="kpi-label">Total a pagar (quinzena)</div>
              <div className="kpi-value">
                {data ? moneyBr(data.total_a_pagar) : "—"}
              </div>
            </article>
            <article className="kpi">
              <div className="kpi-label">Faturamento AGO+</div>
              <div className="kpi-value">
                {data ? moneyBr(data.faturamento_ago_mais.valor) : "—"}
              </div>
            </article>
            <article className="kpi">
              <div className="kpi-label">Recolhas AGO+</div>
              <div className="kpi-value">
                {data?.faturamento_ago_mais.recolhas ?? "—"}
              </div>
            </article>
          </section>

          <section className="painel-block">
            <div className="painel-block-head">
              <h2>A pagar</h2>
              <span>{data?.quinzena_titulo || "Quinzena"}</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Vol.</th>
                    <th>Unit.</th>
                    <th>A pagar</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.a_pagar || []).map((l) => (
                    <tr key={l.tecnico}>
                      <td>{l.tecnico}</td>
                      <td>{l.volume}</td>
                      <td>{moneyBr(l.unitario)}</td>
                      <td>{moneyBr(l.valor)}</td>
                      <td>{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="painel-block">
            <div className="painel-block-head">
              <h2>Faturamento por mês</h2>
              <span>FATURAR</span>
            </div>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Recolhas</th>
                    <th>Faturamento</th>
                    <th>Unit. médio</th>
                    <th>Período</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.faturamento_meses || []).map((m) => (
                    <tr key={m.mes}>
                      <td>{m.mes}</td>
                      <td>{m.recolhas}</td>
                      <td>{moneyBr(m.faturamento)}</td>
                      <td>{moneyBr(m.unitario_medio)}</td>
                      <td>{m.periodo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="painel-foot">
            <p>
              MVP financeiro · atualizado{" "}
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

export default function FinanceiroPage() {
  return (
    <AuthGate>
      <FinanceiroInner />
    </AuthGate>
  );
}
