"use client";

import {
  anosFromMeses,
  buildPeriodo,
  isAnoOnly,
  isMesYm,
  isTotal,
  mesBtnShort,
  mesesNoAno,
  parsePeriodo,
} from "../lib/periodo";

type Props = {
  value: string;
  /** YYYY-MM (e opcionalmente anos) disponíveis na fonte. */
  mesesDisponiveis?: string[];
  /** Fallback de YYYY-MM se a API ainda não trouxe lista. */
  fallbackMeses?: string[];
  onChange: (periodo: string) => void;
  /** Se true, com Ano=TOTAL os meses ficam só TOTAL. */
  disableMesWhenAnoTotal?: boolean;
};

/**
 * Seletor Ano + Mês + TOTAL — visual azul didático (mes-visao).
 * value = TOTAL | YYYY | YYYY-MM.
 */
export default function PeriodoVisaoSelector({
  value,
  mesesDisponiveis = [],
  fallbackMeses = [],
  onChange,
  disableMesWhenAnoTotal = true,
}: Props) {
  const fonte =
    mesesDisponiveis.length > 0 ? mesesDisponiveis : fallbackMeses;
  const parsed = parsePeriodo(value);
  const anoAtivo =
    parsed.kind === "total" ? "TOTAL" : parsed.ano || "TOTAL";
  const mesAtivo: number | "TOTAL" =
    parsed.kind === "mes" && parsed.mesNum ? parsed.mesNum : "TOTAL";

  const anos = ["TOTAL", ...anosFromMeses(fonte)];
  const meses =
    anoAtivo === "TOTAL"
      ? []
      : (() => {
          const list = mesesNoAno(fonte, anoAtivo);
          // Se ainda não há dados do ano, oferece 1–12 para navegação.
          return list.length ? list : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        })();

  const setAno = (ano: string) => {
    if (ano === "TOTAL") {
      onChange("TOTAL");
      return;
    }
    // Mantém mês se existir no novo ano; senão TOTAL do ano.
    if (mesAtivo !== "TOTAL" && typeof mesAtivo === "number") {
      const ym = buildPeriodo(ano, mesAtivo);
      const still = fonte.includes(ym) || !fonte.length;
      onChange(still ? ym : ano);
      return;
    }
    onChange(ano);
  };

  const setMes = (mesNum: number | "TOTAL") => {
    if (anoAtivo === "TOTAL") {
      onChange("TOTAL");
      return;
    }
    onChange(buildPeriodo(anoAtivo, mesNum));
  };

  const mesDisabled = disableMesWhenAnoTotal && anoAtivo === "TOTAL";

  return (
    <div className="periodo-visao" role="group" aria-label="Período">
      <div className="field-month mes-visao-field">
        <span className="mes-visao-label">Ano</span>
        <div className="mes-visao" role="group" aria-label="Ano">
          {anos.map((a) => {
            const active =
              a === "TOTAL"
                ? isTotal(value)
                : anoAtivo === a && !isTotal(value);
            return (
              <button
                key={`ano-${a}`}
                type="button"
                className={`mes-visao-btn${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() => setAno(a)}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field-month mes-visao-field">
        <span className="mes-visao-label">Mês</span>
        <div
          className={`mes-visao${mesDisabled ? " is-disabled" : ""}`}
          role="group"
          aria-label="Mês"
        >
          <button
            type="button"
            className={`mes-visao-btn${mesAtivo === "TOTAL" || isTotal(value) || isAnoOnly(value) ? " is-active" : ""}`}
            aria-pressed={
              mesAtivo === "TOTAL" || isTotal(value) || isAnoOnly(value)
            }
            disabled={mesDisabled}
            onClick={() => setMes("TOTAL")}
          >
            TOTAL
          </button>
          {meses.map((m) => {
            const active = isMesYm(value) && mesAtivo === m;
            return (
              <button
                key={`m-${m}`}
                type="button"
                className={`mes-visao-btn${active ? " is-active" : ""}`}
                aria-pressed={active}
                disabled={mesDisabled}
                onClick={() => setMes(m)}
              >
                {mesBtnShort(m)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
