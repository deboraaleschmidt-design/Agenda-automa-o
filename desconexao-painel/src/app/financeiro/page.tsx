"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import MesVisaoSelector from "../../components/MesVisaoSelector";
import type {
  FinancePayload,
  FinanceSegmento,
} from "../../lib/finance-parse";

function moneyBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "sem preço";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function mesBtnLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const short = [
    "",
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${short[Number(m)] || m}/${y}`;
}

function monthLabel(mes: string): string {
  if (mes.trim().toUpperCase() === "TOTAL") return "TOTAL · período";
  return mesBtnLabel(mes);
}

const MES_FALLBACK: Array<[string, string]> = [
  ["TOTAL", "TOTAL"],
  ["2026-08", "Ago/2026"],
  ["2026-09", "Set/2026"],
  ["2026-10", "Out/2026"],
  ["2026-11", "Nov/2026"],
];

function FinanceiroInner() {
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mes, setMes] = useState("TOTAL");
  const [segmento, setSegmento] = useState<FinanceSegmento>("todos");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesQ = params.get("mes")?.trim();
    const segQ = params.get("segmento")?.trim().toLowerCase();
    if (mesQ) setMes(mesQ);
    if (segQ === "desconexao" || segQ === "iat" || segQ === "todos") {
      setSegmento(segQ);
    }
    setReady(true);
  }, []);

  const load = useCallback(
    async (m: string, seg: FinanceSegmento, refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ mes: m, segmento: seg });
        if (refresh) q.set("refresh", "1");
        const res = await fetch(`/api/financeiro?${q}`, {
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
    },
    [],
  );

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.searchParams.set("mes", mes);
    url.searchParams.set("segmento", segmento);
    window.history.replaceState({}, "", url.toString());
    void load(mes, segmento, true);
  }, [load, mes, segmento, ready]);

  const mesOptions = useMemo((): Array<[string, string]> => {
    const meses = data?.meses_disponiveis || [];
    if (!meses.length) return MES_FALLBACK;
    return [
      ["TOTAL", "TOTAL"],
      ...meses.map((ym): [string, string] => [ym, mesBtnLabel(ym)]),
    ];
  }, [data?.meses_disponiveis]);

  const sub =
    segmento === "desconexao"
      ? data?.subtotais.desconexao
      : segmento === "iat"
        ? data?.subtotais.iat
        : data?.subtotais.geral;

  const showDes = segmento === "desconexao" || segmento === "todos";
  const showIat = segmento === "iat" || segmento === "todos";

  return (
    <div className="painel-page painel-ops">
      <div
        className={data?.fonte === "sheets" ? "live-banner" : "demo-banner"}
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Financeiro Desconexão + IAT"
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
            <span className="status-pill">LPU</span>
            <a className="btn btn-ghost btn-sm" href="/">
              ← Segmentos
            </a>
          </div>
          <div className="painel-controls">
            <MesVisaoSelector
              value={mes}
              options={mesOptions}
              onChange={setMes}
            />
            <label className="field-month">
              Segmento
              <select
                aria-label="Segmento financeiro"
                value={segmento}
                onChange={(e) =>
                  setSegmento(e.target.value as FinanceSegmento)
                }
              >
                <option value="todos">Todos</option>
                <option value="desconexao">Desconexão</option>
                <option value="iat">IAT</option>
              </select>
            </label>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={loading}
              onClick={() => void load(mes, segmento, true)}
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
              <p className="ops-kicker">Faturamento LPU · só leitura</p>
              <h1 className="ops-title">{monthLabel(mes)}</h1>
              <p className="ops-sub">
                {data?.lpu_origem.desconexao}
                {showIat ? ` · ${data?.lpu_origem.iat}` : ""}
              </p>
            </div>
          </div>

          {error ? <p className="banner-error">{error}</p> : null}

          <section className="kpi-grid kpi-grid-ops" aria-label="Totais">
            <article className="kpi kpi-hero reveal">
              <div className="kpi-label">Serviços no período</div>
              <div className="kpi-value">{sub?.servicos ?? "—"}</div>
              <div className="kpi-hint">
                {segmento === "todos"
                  ? "Desconexão + IAT"
                  : segmento === "iat"
                    ? "IAT · BASE desde 01/10"
                    : "Desconexão · Respostas"}
              </div>
            </article>
            <article className="kpi reveal reveal-delay-1">
              <div className="kpi-label">Valor a faturar</div>
              <div className="kpi-value">
                {data ? moneyBr(sub?.valor_faturar ?? 0) : "—"}
              </div>
              <div className="kpi-hint">
                qtd × preço LPU
                {sub?.sem_preco
                  ? ` · ${sub.sem_preco} sem preço`
                  : ""}
              </div>
            </article>
            <article className="kpi reveal reveal-delay-2">
              <div className="kpi-label">A pagar (Desconexão)</div>
              <div className="kpi-value">
                {showDes && data ? moneyBr(data.total_a_pagar) : "—"}
              </div>
              <div className="kpi-hint">
                {showDes
                  ? data?.quinzena_titulo || "Quinzena PAINEL RECOLHAS"
                  : "Só no segmento Desconexão"}
              </div>
            </article>
            {showIat ? (
              <article className="kpi reveal reveal-delay-3">
                <div className="kpi-label">A pagar (IAT)</div>
                <div className="kpi-value">—</div>
                <div className="kpi-hint">
                  {data?.a_pagar_iat_nota || "NÃO INFORMADO"}
                </div>
              </article>
            ) : null}
          </section>

          <section className="painel-block" aria-labelledby="fat-lpu-title">
            <div className="painel-block-head">
              <h2 id="fat-lpu-title">Atividades a faturar</h2>
              <span>
                Código LPU · qtd · unitário · valor ·{" "}
                {data?.atividades.length || 0} linha(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Segmento</th>
                    <th>Código</th>
                    <th>Serviço (LPU)</th>
                    <th>Qtd</th>
                    <th>Unitário</th>
                    <th>A faturar</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.atividades || []).length === 0 ? (
                    <tr>
                      <td colSpan={6}>Sem atividades no período.</td>
                    </tr>
                  ) : (
                    (data?.atividades || []).map((a, i) => (
                      <tr key={`${a.segmento}-${a.codigo}-${i}`}>
                        <td>
                          {a.segmento === "iat" ? "IAT" : "Desconexão"}
                        </td>
                        <td>{a.codigo}</td>
                        <td>
                          {a.descricao}
                          {a.sem_preco ? (
                            <span className="sub"> · sem preço</span>
                          ) : null}
                        </td>
                        <td>{a.quantidade}</td>
                        <td>
                          {a.sem_preco || a.preco_unitario == null
                            ? "sem preço"
                            : moneyBr(a.preco_unitario)}
                        </td>
                        <td>
                          {a.sem_preco || a.valor == null
                            ? "sem preço"
                            : moneyBr(a.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      Subtotal{" "}
                      {segmento === "todos"
                        ? "geral"
                        : segmento === "iat"
                          ? "IAT"
                          : "Desconexão"}
                    </td>
                    <td>{sub?.servicos ?? 0}</td>
                    <td />
                    <td>{moneyBr(sub?.valor_faturar ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="painel-foot" style={{ padding: "0.75rem 1rem" }}>
              Origem: {data?.lpu_origem.desconexao}
              {showIat ? ` · ${data?.lpu_origem.iat}` : ""}
            </p>
          </section>

          {showDes ? (
            <section className="painel-block">
              <div className="painel-block-head">
                <h2>A pagar · Desconexão</h2>
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
                  <tfoot>
                    <tr>
                      <td colSpan={3}>TOTAL</td>
                      <td>{moneyBr(data?.total_a_pagar ?? 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ) : null}

          {showDes ? (
            <section className="painel-block">
              <div className="painel-block-head">
                <h2>FATURAR · conferência mensal</h2>
                <span>Faturar · Desconexão</span>
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
          ) : null}

          {(data?.duvidas || []).length ? (
            <section className="painel-block">
              <div className="painel-block-head">
                <h2>Notas / lacunas</h2>
                <span>sem inventar</span>
              </div>
              <ul className="ops-note-list">
                {(data?.duvidas || []).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="painel-foot">
            <p>
              Etapa 3 · Financeiro · atualizado{" "}
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
