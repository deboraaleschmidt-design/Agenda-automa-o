"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import PeriodoVisaoSelector from "../../components/PeriodoVisaoSelector";
import {
  filterCardMes,
  type HistCard,
  type HistTecnicoPayload,
} from "../../lib/hist-tecnico-parse";
import { labelPeriodo } from "../../lib/periodo";

const FALLBACK_MESES = ["2026-09", "2026-10", "2026-11"];

function HistInner() {
  const [data, setData] = useState<HistTecnicoPayload | null>(null);
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
      const res = await fetch(`/api/historico-tecnico?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as HistTecnicoPayload;
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

  const cards = useMemo((): HistCard[] => {
    return (data?.cards || []).map((c) => filterCardMes(c, mes));
  }, [data, mes]);

  return (
    <div className="painel-page painel-ops">
      <div
        className={data?.fonte === "sheets" ? "live-banner" : "demo-banner"}
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Histórico Técnico"
          : data?.mensagem || "Aguardando Sheets / D-1"}
      </div>
      <header className="painel-header">
        <div className="container painel-header-inner">
          <div className="painel-identity">
            <a className="brand" href="/">
              T.ESTRATÉGICO
            </a>
            <span className="empresa">
              <strong>Histórico Técnico</strong>
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
              <p className="ops-kicker">Leitura só · cards por técnico</p>
              <h1 className="ops-title">{labelPeriodo(mes)}</h1>
              <p className="ops-sub">{data?.titulo || "—"}</p>
            </div>
          </div>

          {error ? <p className="banner-error">{error}</p> : null}
          {data?.ordem_nota ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.ordem_nota}
            </p>
          ) : null}

          <div className="hist-card-grid">
            {cards.map((card) => (
              <article
                key={card.tecnico}
                className={`hist-card reveal hist-card-${foldVinculo(card.vinculo)}`}
              >
                <header className="hist-card-head">
                  <h2>{card.tecnico}</h2>
                  <span className="hist-vinculo">{card.vinculo}</span>
                </header>
                <p className="hist-card-meta">
                  Período: {card.atividades} atividades (visitas) · {card.tarefas}{" "}
                  tarefas
                </p>
                {card.meses.map((m) => (
                  <div key={m.chave + m.titulo} className="hist-mes">
                    <h3>{m.titulo}</h3>
                    <div className="table-wrap">
                      <table className="data compact">
                        <thead>
                          <tr>
                            <th>Atividade</th>
                            <th>Qtde</th>
                            <th>Valor unit.</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.linhas.length === 0 ? (
                            <tr>
                              <td colSpan={4}>Sem linhas neste mês</td>
                            </tr>
                          ) : (
                            m.linhas.map((l, i) => (
                              <tr key={`${l.atividade}-${i}`}>
                                <td>{l.atividade}</td>
                                <td>{l.qtde || "—"}</td>
                                <td className={l.sem_preco ? "sem-preco" : ""}>
                                  {l.sem_preco ? "sem preço" : l.valor_unit}
                                </td>
                                <td className={l.sem_preco ? "sem-preco" : ""}>
                                  {l.sem_preco ? "sem preço" : l.total}
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="hist-subtotal">
                            <td>Subtotal</td>
                            <td>{m.subtotal_qtde || "—"}</td>
                            <td />
                            <td>{m.subtotal_valor}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <footer className="hist-card-total">
                  <span>Total do período</span>
                  <strong>
                    {card.total_qtde || "—"} · {card.total_valor}
                  </strong>
                </footer>
              </article>
            ))}
          </div>

          {!loading && cards.length === 0 ? (
            <p className="painel-foot">Sem cards legíveis na aba.</p>
          ) : null}

          <div className="painel-foot">
            <p>
              Histórico Técnico · atualizado{" "}
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

function foldVinculo(v: string): string {
  return v.toLowerCase().includes("pj") ? "pj" : "clt";
}

export default function HistoricoTecnicoPage() {
  return (
    <AuthGate>
      <HistInner />
    </AuthGate>
  );
}
