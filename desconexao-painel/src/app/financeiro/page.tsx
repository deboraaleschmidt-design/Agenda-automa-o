"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import PeriodoVisaoSelector from "../../components/PeriodoVisaoSelector";
import type {
  FinancePayload,
  FinanceSegmento,
} from "../../lib/finance-parse";
import { downloadCsv, rowsToCsv } from "../../lib/export-csv";
import { labelPeriodo } from "../../lib/periodo";

function moneyBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "sem preço";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function pctBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

const FALLBACK_MESES = ["2026-08", "2026-09", "2026-10", "2026-11"];

function monthLabel(mes: string): string {
  return labelPeriodo(mes);
}

const SETOR_BTNS: Array<[FinanceSegmento, string]> = [
  ["desconexao", "DESCONEXÃO"],
  ["iat", "IAT"],
  ["neutra", "NEUTRA"],
  ["todos", "TODOS"],
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
    if (
      segQ === "desconexao" ||
      segQ === "iat" ||
      segQ === "neutra" ||
      segQ === "todos"
    ) {
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

  const sub =
    segmento === "desconexao"
      ? data?.subtotais.desconexao
      : segmento === "iat"
        ? data?.subtotais.iat
        : segmento === "neutra"
          ? data?.subtotais.neutra
          : data?.subtotais.geral;

  const showDes = segmento === "desconexao" || segmento === "todos";
  const showIat = segmento === "iat" || segmento === "todos";
  const showNeutra = segmento === "neutra" || segmento === "todos";
  const opex = data?.opex;
  const quinzenas = data?.pagamento_quinzenas || [];

  return (
    <div className="painel-page painel-ops">
      <div
        className={data?.fonte === "sheets" ? "live-banner" : "demo-banner"}
        role="status"
      >
        {data?.fonte === "sheets"
          ? "AO VIVO · T.ESTRATÉGICO · Financeiro Desconexão + IAT + Neutra"
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
            <span className="status-pill">LPU · OPEX</span>
            <a className="btn btn-ghost btn-sm" href="/">
              ← Segmentos
            </a>
          </div>
          <div className="painel-controls">
            <div className="field-month mes-visao-field">
              <span className="mes-visao-label">Setor</span>
              <div
                className="mes-visao"
                role="group"
                aria-label="Selecionar setor"
              >
                {SETOR_BTNS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`mes-visao-btn${segmento === id ? " is-active" : ""}`}
                    aria-pressed={segmento === id}
                    onClick={() => setSegmento(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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
                const lines = data?.atividades || [];
                const csv = rowsToCsv(
                  [
                    "segmento",
                    "codigo",
                    "descricao",
                    "quantidade",
                    "preco_unitario",
                    "valor",
                    "sem_preco",
                  ],
                  lines.map((l) => [
                    l.segmento,
                    l.codigo,
                    l.descricao,
                    l.quantidade,
                    l.preco_unitario ?? "",
                    l.valor ?? "",
                    l.sem_preco ? "sim" : "",
                  ]),
                );
                downloadCsv(`financeiro-${segmento}-${mes}.csv`, csv);
              }}
            >
              Exportar CSV
            </button>
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
              <p className="ops-kicker">Faturamento LPU · OPEX · só leitura</p>
              <h1 className="ops-title">{monthLabel(mes)}</h1>
              <p className="ops-sub">
                {showDes ? data?.lpu_origem.desconexao : null}
                {showDes && showIat ? " · " : null}
                {showIat ? data?.lpu_origem.iat : null}
                {(showDes || showIat) && showNeutra ? " · " : null}
                {showNeutra ? data?.lpu_origem.neutra : null}
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
                  ? "Desconexão + IAT + Neutra"
                  : segmento === "iat"
                    ? "IAT · BASE+PROMPT"
                    : segmento === "neutra"
                      ? "Neutra · BASE INST/MUD"
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
                {sub?.sem_preco ? ` · ${sub.sem_preco} sem preço` : ""}
              </div>
            </article>
            <article className="kpi reveal reveal-delay-2">
              <div className="kpi-label">Custo OPEX</div>
              <div className="kpi-value">
                {opex ? moneyBr(opex.custo_total) : "—"}
              </div>
              <div className="kpi-hint">
                PJ + CLT + parceiro
                {opex
                  ? ` · PJ R$ ${opex.rate_pj}${
                      segmento === "iat"
                        ? "/OS"
                        : segmento === "neutra"
                          ? "/at."
                          : "/unid."
                    } · CLT R$ ${opex.salario_clt.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : ""}
              </div>
            </article>
            <article
              className={`kpi reveal reveal-delay-3 ${
                opex
                  ? opex.lucro >= 0
                    ? "kpi-ok"
                    : "kpi-loss"
                  : ""
              }`}
            >
              <div className="kpi-label">
                {opex && opex.lucro < 0 ? "Prejuízo" : "Lucro"}
              </div>
              <div className="kpi-value">
                {opex ? moneyBr(opex.lucro) : "—"}
              </div>
              <div className="kpi-hint">
                margem {opex ? pctBr(opex.margem) : "—"}
                {opex?.sem_preco ? ` · ${opex.sem_preco} sem preço` : ""}
              </div>
            </article>
          </section>

          {/* (a) Pagamento por quinzena */}
          <section className="painel-block" aria-labelledby="quinzena-title">
            <div className="painel-block-head">
              <h2 id="quinzena-title">Pagamento técnicos por quinzena</h2>
              <span>
                só PJ na data · sábado = útil · CLT sem quinzena
              </span>
            </div>
            <div className="neutra-pay-legend">
              <p>
                1ª (1–15) paga dia 20 (ou próximo útil) · 2ª (16–fim) paga dia 5
                do mês seguinte (ou próximo útil). Domingo/feriado empurram.
              </p>
            </div>
            {quinzenas.length === 0 ? (
              <p className="painel-foot" style={{ padding: "1rem" }}>
                Sem quinzenas no período.
              </p>
            ) : (
              quinzenas.map((q) => (
                <div key={q.id} style={{ marginBottom: "1rem" }}>
                  <div
                    className="painel-block-head"
                    style={{ background: "transparent" }}
                  >
                    <h2 style={{ fontSize: "1.05rem" }}>
                      {q.titulo} · corte {q.corte}
                    </h2>
                    <span>pago em {q.pago_em}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Técnico</th>
                          <th>Tipo</th>
                          <th>Ativ.</th>
                          <th>Valor</th>
                          <th>Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.linhas.length === 0 ? (
                          <tr>
                            <td colSpan={5}>Sem linhas nesta quinzena.</td>
                          </tr>
                        ) : (
                          q.linhas.map((l, i) => (
                            <tr key={`${q.id}-${l.tecnico}-${i}`}>
                              <td>{l.tecnico}</td>
                              <td>{l.tipo}</td>
                              <td>{l.atividades}</td>
                              <td>
                                {l.tipo === "CLT"
                                  ? "—"
                                  : moneyBr(l.valor)}
                              </td>
                              <td className="sub">{l.nota || ""}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>TOTAL PJ/parceiro</td>
                          <td>{moneyBr(q.total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* (b) Visão mensal */}
          <section className="painel-block" aria-labelledby="mensal-title">
            <div className="painel-block-head">
              <h2 id="mensal-title">Visão mensal</h2>
              <span>{data?.visao_mensal.titulo || "total pago no mês"}</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.visao_mensal.linhas || []).length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sem pagamentos no mês.</td>
                    </tr>
                  ) : (
                    (data?.visao_mensal.linhas || []).map((l, i) => (
                      <tr key={`m-${l.tecnico}-${i}`}>
                        <td>{l.tecnico}</td>
                        <td>{l.tipo}</td>
                        <td>{moneyBr(l.valor)}</td>
                        <td className="sub">{l.nota || ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>TOTAL pago no mês</td>
                    <td>{moneyBr(data?.visao_mensal.total_pago ?? 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* (c) OPEX */}
          <section className="painel-block" aria-labelledby="opex-title">
            <div className="painel-block-head">
              <h2 id="opex-title">OPEX · custo × receita LPU</h2>
              <span>lucro/prejuízo + margem</span>
            </div>
            {opex ? (
              <>
                <section
                  className="kpi-grid kpi-grid-ops"
                  aria-label="OPEX resumo"
                  style={{ padding: "0.85rem 1rem 0" }}
                >
                  <article className="kpi">
                    <div className="kpi-label">Receita LPU</div>
                    <div className="kpi-value">{moneyBr(opex.receita)}</div>
                    <div className="kpi-hint">
                      {opex.sem_preco
                        ? `${opex.sem_preco} sem preço`
                        : "faturar período"}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Custo PJ</div>
                    <div className="kpi-value">{moneyBr(opex.custo_pj)}</div>
                    <div className="kpi-hint">
                      {segmento === "iat"
                        ? `R$ ${opex.rate_pj}/OS produtiva (409)`
                        : segmento === "neutra"
                          ? `R$ ${opex.rate_pj}/atividade produtiva`
                          : `R$ ${opex.rate_pj}/unid. produtiva`}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Custo CLT + parceiro</div>
                    <div className="kpi-value">
                      {moneyBr(opex.custo_clt + opex.custo_parceiro)}
                    </div>
                    <div className="kpi-hint">
                      CLT {moneyBr(opex.custo_clt)} · parceiro{" "}
                      {moneyBr(opex.custo_parceiro)}
                    </div>
                  </article>
                  <article
                    className={opex.lucro >= 0 ? "kpi kpi-ok" : "kpi kpi-loss"}
                  >
                    <div className="kpi-label">
                      {opex.lucro >= 0 ? "Lucro" : "Prejuízo"}
                    </div>
                    <div className="kpi-value">{moneyBr(opex.lucro)}</div>
                    <div className="kpi-hint">margem {pctBr(opex.margem)}</div>
                  </article>
                </section>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Técnico</th>
                        <th>Categoria</th>
                        <th>Detalhe</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opex.linhas.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Sem linhas de custo.</td>
                        </tr>
                      ) : (
                        opex.linhas.map((l, i) => (
                          <tr key={`ox-${l.tecnico}-${i}`}>
                            <td>{l.tecnico}</td>
                            <td>{l.categoria}</td>
                            <td>{l.detalhe}</td>
                            <td>
                              {l.valor == null ? "—" : moneyBr(l.valor)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>CUSTO TOTAL</td>
                        <td>{moneyBr(opex.custo_total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <p className="painel-foot" style={{ padding: "1rem" }}>
                OPEX indisponível neste recorte.
              </p>
            )}
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
                          {a.segmento === "iat"
                            ? "IAT"
                            : a.segmento === "neutra"
                              ? "Neutra"
                              : "Desconexão"}
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
                          : segmento === "neutra"
                            ? "Neutra"
                            : "Desconexão"}
                    </td>
                    <td>{sub?.servicos ?? 0}</td>
                    <td />
                    <td>{moneyBr(sub?.valor_faturar ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {showNeutra ? (
            <section className="painel-block" aria-labelledby="ok-tci-title">
              <div className="painel-block-head">
                <h2 id="ok-tci-title">Total OK TCI · por técnico</h2>
                <span>Neutra · produtivas com preço LPU</span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Técnico</th>
                      <th>Área</th>
                      <th>Serviços OK</th>
                      <th>A faturar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.ok_tci_tecnicos || []).length === 0 ? (
                      <tr>
                        <td colSpan={4}>Sem OK TCI no período.</td>
                      </tr>
                    ) : (
                      (data?.ok_tci_tecnicos || []).map((t) => (
                        <tr key={t.tt || t.nome}>
                          <td>{t.nome}</td>
                          <td>{t.area}</td>
                          <td>{t.servicos_ok}</td>
                          <td>{moneyBr(t.valor)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {showDes ? (
            <section className="painel-block" aria-labelledby="recolhas-aberto-title">
              <div className="painel-block-head">
                <h2 id="recolhas-aberto-title">
                  Recolhas a pagar (em aberto)
                </h2>
                <span>
                  {data?.recolhas_aberto?.titulo ||
                    data?.quinzena_titulo ||
                    "PAINEL RECOLHAS"}
                </span>
              </div>
              <div className="neutra-pay-legend">
                <p>
                  Pendente = quinzena vigente + fechadas em atraso · Fechado/pago
                  = fechamento até o corte (planilha).
                </p>
              </div>
              <div className="painel-block-head" style={{ background: "transparent" }}>
                <h2 style={{ fontSize: "1.05rem" }}>Pendente</h2>
                <span>
                  {(data?.recolhas_aberto?.pendentes || data?.a_pagar || []).length}{" "}
                  linha(s)
                </span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Técnico</th>
                      <th>Recolhas</th>
                      <th>Unit.</th>
                      <th>A pagar</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recolhas_aberto?.pendentes || data?.a_pagar || [])
                      .length === 0 ? (
                      <tr>
                        <td colSpan={5}>Nenhuma recolha pendente.</td>
                      </tr>
                    ) : (
                      (data?.recolhas_aberto?.pendentes || data?.a_pagar || []).map(
                        (l, i) => (
                          <tr key={`pend-${l.tecnico}-${i}`}>
                            <td>{l.tecnico}</td>
                            <td>{l.volume}</td>
                            <td>{moneyBr(l.unitario)}</td>
                            <td>{moneyBr(l.valor)}</td>
                            <td className="sub">
                              {l.status}
                              {l.periodo ? ` · ${l.periodo}` : ""}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>TOTAL pendente</td>
                      <td>
                        {moneyBr(
                          (data?.recolhas_aberto?.pendentes || data?.a_pagar || []).reduce(
                            (s, l) => s + (l.valor || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="painel-block-head" style={{ background: "transparent" }}>
                <h2 style={{ fontSize: "1.05rem" }}>Fechado / pago</h2>
                <span>
                  {(data?.recolhas_aberto?.fechados || []).length} linha(s)
                </span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Técnico</th>
                      <th>Recolhas</th>
                      <th>Unit.</th>
                      <th>Total</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recolhas_aberto?.fechados || []).length === 0 ? (
                      <tr>
                        <td colSpan={5}>Sem fechamento neste espelho.</td>
                      </tr>
                    ) : (
                      (data?.recolhas_aberto?.fechados || []).map((l, i) => (
                        <tr key={`fech-${l.tecnico}-${i}`}>
                          <td>{l.tecnico}</td>
                          <td>{l.volume}</td>
                          <td>{moneyBr(l.unitario)}</td>
                          <td>{moneyBr(l.valor)}</td>
                          <td className="sub">
                            {l.status}
                            {l.periodo ? ` · ${l.periodo}` : ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>TOTAL fechamento</td>
                      <td>
                        {moneyBr(
                          (data?.recolhas_aberto?.fechados || []).reduce(
                            (s, l) => s + (l.valor || 0),
                            0,
                          ),
                        )}
                      </td>
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
              Financeiro OPEX · atualizado{" "}
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
