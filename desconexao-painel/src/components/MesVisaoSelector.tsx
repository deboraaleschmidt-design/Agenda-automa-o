"use client";

type Option = [value: string, label: string];

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  label?: string;
};

/** Seletor Mês + TOTAL em botões — mesmo visual em /painel e /iat. */
export default function MesVisaoSelector({
  value,
  options,
  onChange,
  label = "Visão",
}: Props) {
  return (
    <div className="field-month mes-visao-field">
      <span className="mes-visao-label">{label}</span>
      <div
        className="mes-visao"
        role="group"
        aria-label="Selecionar mês ou TOTAL"
      >
        {options.map(([v, l]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              className={`mes-visao-btn${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(v)}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
