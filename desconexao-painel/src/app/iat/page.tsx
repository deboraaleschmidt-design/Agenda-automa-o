"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import MesVisaoSelector from "../../components/MesVisaoSelector";
import {
  filterIatBlocks,
  type IatBase,
  type IatPayload,
} from "../../lib/iat-parse";

function pct(n: number): string {
  return `${(Math.round(n * 1000) / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function monthLabel(mes: string): string {
  if (mes.trim().toUpperCase() === "TOTAL")
    return "TOTAL · BASE IAT (set≥22/09 + out + nov)";
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

/** Mesmo componente visual do /painel — IAT: TOTAL + Set/Out/Nov. */
const MES_OPTIONS: Array<[string, string]> = [
  ["TOTAL", "TOTAL"],
  ["2026-09", "Set/2026"],
  ["2026-10", "Out/2026"],
  ["2026-11", "Nov/2026"],
];

function IatInner() {
  const [data, setData] = useState<IatPayload | null>(null);
  const [base, setBase] = useState<IatBase>("TOTAL");
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

  const load = useCallback(async (m: string, refresh = false) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ mes: m });
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/iat?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as IatPayload;
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

  const blocos = useMemo(
    () => filterIatBlocks(data?.blocos || [], base),
    [data, base],
  );
  const resumo = (data?.resumo || []).find((r) =>
    base === "TOTAL"
      ? r.base === "TOTAL"
      : r.base === base || (base === "PORTO ALEGRE" && r.base.includes("PORTO")),
  );
  const ranking = useMemo(() => {
    const list = data?.ranking || [];
    if (base === "TOTAL") return list;
    return list.filter((r) => r.base === base);
  }, [data, base]);
  const maxRank = Math.max(1, ...ranking.map((r) => r.produtivas));

  const ok = data?.painel_ok.resumo;
  const okTechs = (data?.painel_ok.tecnicos || []).filter((t) =>
    base === "TOTAL" ? true : t.base === base || (base === "PORTO ALEGRE" && t.base.includes("PORTO")),
  );
  const ret = data?.retorno.resumo;
  const ofensores = data?.retorno.ofensores || [];
  const motivos = data?.retorno.motivos || [];
  const gabriel = (data?.equipe || []).find((e) =>
    e.nome.toUpperCase().includes("GABRIEL"),
  );

  return (
    <div className="painel-page painel-ops">
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
              <strong>IAT</strong> · operacional
            </span>
            <span className="status-pill">D-1</span>
            {data?.fonte ? (
              <span className="status-pill">{data.fonte}</span>
            ) : null}
          </div>
          <div className="painel-controls">
            <MesVisaoSelector
              value={mes}
              options={MES_OPTIONS}
              onChange={setMes}
            />
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
              <p className="ops-kicker">Leitura só · D-1 · BASE IAT</p>
              <h1 className="ops-title">{monthLabel(mes)}</h1>
              <p className="ops-sub">{data?.titulo || "—"}</p>
            </div>
            {gabriel ? (
              <p className="ops-note" role="note">
                EQUIPE · Gabriel: <strong>{gabriel.tipo}</strong> · {gabriel.base}
              </p>
            ) : null}
          </div>

          {error ? <p className="banner-error">{error}</p> : null}
          {data?.mensagem ? (
            <p className="painel-foot" style={{ marginBottom: "1rem" }}>
              {data.mensagem}
            </p>
          ) : null}

          <section className="kpi-grid kpi-grid-ops" aria-label="Resumo IAT">
            <article className="kpi kpi-hero reveal">
              <div className="kpi-label">Produtivas</div>
              <div className="kpi-value">{resumo?.produtivas ?? "—"}</div>
              <div className="kpi-hint">contrato · BASE · {base}</div>
            </article>
            <article className="kpi reveal reveal-delay-1">
              <div className="kpi-label">Improdutivas</div>
              <div className="kpi-value">{resumo?.improdutivas ?? "—"}</div>
              <div className="kpi-hint">BASE IAT</div>
            </article>
            <article className="kpi reveal reveal-delay-2">
              <div className="kpi-label">Contratos</div>
              <div className="kpi-value">{resumo?.total_contratos ?? "—"}</div>
              <div className="kpi-hint">prod + improd</div>
            </article>
            <article className="kpi reveal reveal-delay-3">
              <div className="kpi-label">% Painel</div>
              <div className="kpi-value">
                {resumo ? pct(resumo.pct_produtivas) : "—"}
              </div>
              <div className="kpi-hint">OK ÷ (OK + improd)</div>
            </article>
          </section>

          <section className="painel-block" aria-labelledby="rank-iat">
            <div className="painel-block-head">
              <h2 id="rank-iat">Ranking · produtivas</h2>
              <span>maior → menor · BASE IAT</span>
            </div>
            <div className="rank-list">
              {ranking.length === 0 ? (
                <p className="painel-foot" style={{ padding: "1rem" }}>
                  Sem ranking para {monthLabel(mes)}.
                </p>
              ) : (
                ranking.map((r, i) => (
                  <div className="rank-row" key={`${r.base}-${r.tecnico}`}>
                    <span className="rank-pos">{i + 1}</span>
                    <div className="rank-meta">
                      <strong>{r.tecnico}</strong>
                      <span className="sub">
                        {r.base} · improd {r.improdutivas}
                      </span>
                    </div>
                    <div className="rank-bar-track">
                      <div
                        className="rank-bar"
                        style={{
                          width: `${Math.max(4, Math.round((r.produtivas / maxRank) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="rank-vol">{r.produtivas}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {blocos.map((b) => {
            const maxCell = Math.max(
              1,
              ...b.tecnicos.flatMap((t) => t.dias),
            );
            return (
              <section
                className="painel-block"
                key={`${b.kind}-${b.base}`}
                aria-label={`${b.kind} ${b.base}`}
              >
                <div className="painel-block-head">
                  <h2>
                    {b.kind === "produtivas" ? "Produtivas" : "Improdutivas"} ·{" "}
                    {b.base}
                  </h2>
                  <span>dia × técnico · BASE IAT</span>
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
                          {b.diasHeader.map((_, i) => {
                            const n = t.dias[i] ?? 0;
                            const hot = n > 0 && n >= maxCell * 0.6;
                            return (
                              <td
                                key={`${t.tecnico}-${i}`}
                                className={hot ? "cell-hot" : undefined}
                              >
                                {n}
                              </td>
                            );
                          })}
                          <td>{t.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="painel-block" aria-labelledby="ok-title">
            <div className="painel-block-head">
              <h2 id="ok-title">PAINEL OK</h2>
              <span>calculado da BASE · vivo</span>
            </div>
            {ok ? (
              <>
                <p className="painel-foot" style={{ padding: "0 1rem" }}>
                  {ok.periodo_nota}
                </p>
                <section className="kpi-grid" style={{ padding: "1rem" }}>
                  <article className="kpi">
                    <div className="kpi-label">Contratos OK (E6)</div>
                    <div className="kpi-value">{ok.contratos_ok.total}</div>
                    <div className="kpi-hint">
                      C {ok.contratos_ok.canoas} · POA {ok.contratos_ok.poa}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Improdutivas (E7)</div>
                    <div className="kpi-value">{ok.improdutivas.total}</div>
                    <div className="kpi-hint">
                      C {ok.improdutivas.canoas} · POA {ok.improdutivas.poa}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">% Painel (E14)</div>
                    <div className="kpi-value">{pct(ok.pct_painel.total)}</div>
                    <div className="kpi-hint">
                      C {pct(ok.pct_painel.canoas)} · POA {pct(ok.pct_painel.poa)}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Adesão / Migração</div>
                    <div className="kpi-value">
                      {ok.adesao_ok}/{ok.migracao_ok}
                    </div>
                    <div className="kpi-hint">tarefas nos OK</div>
                  </article>
                </section>
                {ok.ofensor ? (
                  <p className="ops-note" style={{ margin: "0 1rem 1rem" }}>
                    Ofensor: {ok.ofensor}
                  </p>
                ) : null}
                <div className="table-wrap">
                  <table className="data compact">
                    <thead>
                      <tr>
                        <th>Pos.</th>
                        <th>Técnico</th>
                        <th>Base</th>
                        <th>Vínculo</th>
                        <th>OK</th>
                        <th>Improd</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {okTechs.map((t) => (
                        <tr key={`${t.base}-${t.login}`}>
                          <td>{t.pos}</td>
                          <td>
                            {t.tecnico}
                            <span className="sub"> {t.login}</span>
                          </td>
                          <td>{t.base}</td>
                          <td>{t.vinculo}</td>
                          <td>{t.contratos_ok}</td>
                          <td>{t.improdutivas}</td>
                          <td>{pct(t.pct_painel)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="painel-foot" style={{ padding: "1rem" }}>
                PAINEL OK sem dados legíveis.
              </p>
            )}
          </section>

          <section className="painel-block" aria-labelledby="ret-title">
            <div className="painel-block-head">
              <h2 id="ret-title">RETORNO CREDENCIADA</h2>
              <span>ofensor · técnico pai</span>
            </div>
            {ret ? (
              <>
                <p className="painel-foot" style={{ padding: "0 1rem" }}>
                  {ret.periodo_nota}
                </p>
                <section className="kpi-grid" style={{ padding: "1rem" }}>
                  <article className="kpi">
                    <div className="kpi-label">Retornos concluídos</div>
                    <div className="kpi-value">
                      {ret.retornos_concluidos.total}
                    </div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Gerados (pai)</div>
                    <div className="kpi-value">{ret.retornos_gerados.total}</div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Pai ≠ quem atendeu</div>
                    <div className="kpi-value">{ret.pai_diferente.total}</div>
                  </article>
                  <article className="kpi">
                    <div className="kpi-label">Pai = quem atendeu</div>
                    <div className="kpi-value">{ret.pai_igual.total}</div>
                  </article>
                </section>
                {ret.maior_motivo ? (
                  <p className="ops-note" style={{ margin: "0 1rem 1rem" }}>
                    Maior motivo: {ret.maior_motivo}
                  </p>
                ) : null}
                <div className="table-wrap">
                  <table className="data compact">
                    <thead>
                      <tr>
                        <th>Pos.</th>
                        <th>Técnico pai</th>
                        <th>Base</th>
                        <th>Retornos</th>
                        <th>Maior motivo</th>
                        <th>Outro atendeu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ofensores.map((o) => (
                        <tr key={`${o.pos}-${o.login}-${o.tecnico}`}>
                          <td>{o.pos}</td>
                          <td>
                            {o.tecnico}
                            <span className="sub"> {o.login}</span>
                          </td>
                          <td>{o.base}</td>
                          <td>{o.retornos}</td>
                          <td>{o.maior_motivo}</td>
                          <td>{o.atendidos_outro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
                  <table className="data compact">
                    <thead>
                      <tr>
                        <th>Cód.</th>
                        <th>Motivo</th>
                        <th>Canoas</th>
                        <th>POA</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {motivos.map((m) => (
                        <tr key={m.codigo}>
                          <td>{m.codigo}</td>
                          <td>{m.descricao}</td>
                          <td>{m.canoas}</td>
                          <td>{m.poa}</td>
                          <td>{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="painel-foot" style={{ padding: "1rem" }}>
                RETORNO sem dados legíveis.
              </p>
            )}
          </section>

          <div className="painel-foot">
            <p>
              Etapa 2 · IAT · atualizado{" "}
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
