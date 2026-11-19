/**
 * Junta BASE NEUTRA HIST + BASE NEUTRA + PROMPT NEUTRA.
 * Ordem: HIST → BASE → PROMPT; parseBaseNeutraRegs dedupe por Número SA
 * (última ocorrência vence).
 */
export function mergeNeutraSheetRows(parts: {
  hist?: unknown[][];
  base?: unknown[][];
  prompt?: unknown[][];
}): { rows: unknown[][]; fontes: string[]; histPresente: boolean } {
  const hist = parts.hist || [];
  const base = parts.base || [];
  const prompt = parts.prompt || [];
  const header =
    (base[0] && base[0].length ? base[0] : null) ||
    (prompt[0] && prompt[0].length ? prompt[0] : null) ||
    (hist[0] && hist[0].length ? hist[0] : null) ||
    [];
  const body = [
    ...(hist.length > 1 ? hist.slice(1) : []),
    ...(base.length > 1 ? base.slice(1) : []),
    ...(prompt.length > 1 ? prompt.slice(1) : []),
  ];
  const fontes: string[] = [];
  const histPresente = hist.length > 1;
  if (histPresente) fontes.push("BASE NEUTRA HIST");
  if (base.length > 1) fontes.push("BASE NEUTRA");
  if (prompt.length > 1) fontes.push("PROMPT NEUTRA");
  return { rows: header.length ? [header, ...body] : body, fontes, histPresente };
}
