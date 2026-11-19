/**
 * Junta PROMPT NEUTRA + BASE NEUTRA HIST + BASE NEUTRA.
 * Ordem de precedência (1ª ocorrência vence no parse):
 *   PROMPT NEUTRA > BASE NEUTRA HIST > BASE NEUTRA
 * (BASE traz status antigos em nov — não pode sobrescrever PROMPT/HIST.)
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
    (prompt[0] && prompt[0].length ? prompt[0] : null) ||
    (hist[0] && hist[0].length ? hist[0] : null) ||
    (base[0] && base[0].length ? base[0] : null) ||
    [];
  // Ordem no array = ordem de leitura; parse usa 1ª ocorrência por SA.
  const body = [
    ...(prompt.length > 1 ? prompt.slice(1) : []),
    ...(hist.length > 1 ? hist.slice(1) : []),
    ...(base.length > 1 ? base.slice(1) : []),
  ];
  const fontes: string[] = [];
  const histPresente = hist.length > 1;
  if (prompt.length > 1) fontes.push("PROMPT NEUTRA");
  if (histPresente) fontes.push("BASE NEUTRA HIST");
  if (base.length > 1) fontes.push("BASE NEUTRA");
  return {
    rows: header.length ? [header, ...body] : body,
    fontes,
    histPresente,
  };
}
