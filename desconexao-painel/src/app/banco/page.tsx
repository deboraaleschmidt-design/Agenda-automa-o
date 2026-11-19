"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";

type BancoStatus = {
  ok: boolean;
  atividades_neutra: number;
  snapshots_mensais: Array<{
    segmento: string;
    ano_mes: string;
    fechado: boolean;
    payload: {
      produtivas?: number;
      improdutivas?: number;
      concluidas?: number;
      fontes?: string[];
    };
  }>;
  ultimos_sync: Array<{
    id: string;
    started_at: string;
    finished_at: string | null;
    trigger: string;
    status: string;
    detalhe: { mensagem?: string; hist_presente?: boolean } | null;
  }>;
};

function BancoInner() {
  const [data, setData] = useState<BancoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/banco", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as BancoStatus);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync?mes=TOTAL", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="painel-shell">
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Banco</strong>
            </span>
            <span className="status-pill">Postgres · opção A</span>
            <a className="btn btn-ghost btn-sm" href="/">
              ← Segmentos
            </a>
          </div>
          <div className="painel-controls">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={syncing}
              onClick={() => void syncNow()}
            >
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </button>
          </div>
        </div>
      </header>

      <div className="container painel-body">
        {error ? <p className="banner-error">{error}</p> : null}
        {loading && !data ? <p>Carregando…</p> : null}

        <section className="kpi-grid" aria-label="Resumo banco">
          <article className="kpi">
            <div className="kpi-label">Atividades Neutra</div>
            <div className="kpi-value">{data?.atividades_neutra ?? "—"}</div>
            <div className="kpi-hint">Upsert por Número SA</div>
          </article>
          <article className="kpi">
            <div className="kpi-label">Snapshots mensais</div>
            <div className="kpi-value">
              {data?.snapshots_mensais?.length ?? "—"}
            </div>
            <div className="kpi-hint">ano_mes indexado · fechar mês ao terminar</div>
          </article>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <h2>Neutra por mês</h2>
          <p className="kpi-hint">
            Concluídas = produtivas + improdutivas (aceite TCI). Sem CPF/PII.
          </p>
          <div className="kpi-grid">
            {(data?.snapshots_mensais || []).map((m) => (
              <article className="kpi" key={m.ano_mes}>
                <div className="kpi-label">
                  {m.ano_mes}
                  {m.fechado ? " · fechado" : ""}
                </div>
                <div className="kpi-value">{m.payload?.concluidas ?? "—"}</div>
                <div className="kpi-hint">
                  prod {m.payload?.produtivas ?? "—"} · improd{" "}
                  {m.payload?.improdutivas ?? "—"}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <h2>Últimos sync</h2>
          <p className="kpi-hint">
            Botão + cron 07:00 via POST /api/cron/sync (token do painel).
          </p>
          <ul>
            {(data?.ultimos_sync || []).map((r) => (
              <li key={r.id}>
                {String(r.started_at)} · {r.trigger} · {r.status}
                {r.detalhe?.mensagem ? ` — ${r.detalhe.mensagem}` : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default function BancoPage() {
  return (
    <AuthGate>
      <BancoInner />
    </AuthGate>
  );
}
