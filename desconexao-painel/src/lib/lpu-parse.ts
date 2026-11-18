/** Parse LPU Desconexão e IAT (só leitura; títulos internos de aba Sheets). */

export type LpuItem = {
  codigo: string;
  descricao: string;
  preco: number | null;
  situacao: string;
  foldDesc: string;
};

function fold(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function money(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cell(row: unknown[] | undefined, i: number): string {
  return String(row?.[i] ?? "").trim();
}

/** LPU Desconexão: Descrição | Preço bruto. */
export function parseLpuDesconexao(rows: unknown[][]): LpuItem[] {
  const items: LpuItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const desc = cell(rows[i], 0);
    if (!desc) continue;
    const u = fold(desc);
    if (u.startsWith("DESCRI") || u.startsWith("PRECO")) continue;
    const preco = money(rows[i]?.[1]);
    const codigoMatch = desc.match(/^([\d.]+)\s*[-–—]/);
    const codigo = codigoMatch ? codigoMatch[1] : desc.slice(0, 12);
    items.push({
      codigo,
      descricao: desc,
      preco,
      situacao: preco == null ? "Sem valor informado" : "Tabela",
      foldDesc: fold(desc),
    });
  }
  return items;
}

/** LPU IAT: ITEM | DESCRIÇÃO | tempo | VALOR | SITUAÇÃO. */
export function parseLpuIat(rows: unknown[][]): {
  items: LpuItem[];
  valorHora: number | null;
} {
  let valorHora: number | null = null;
  const items: LpuItem[] = [];
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    for (let c = 0; c < (rows[i] || []).length; c++) {
      if (fold(rows[i]?.[c]).includes("VALOR HS")) {
        valorHora = money(rows[i]?.[c + 1]);
      }
    }
  }
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (fold(rows[i]?.[0]) === "ITEM") {
      header = i;
      break;
    }
  }
  const start = header >= 0 ? header + 1 : 1;
  for (let i = start; i < rows.length; i++) {
    const codigo = cell(rows[i], 0).replace(/\s/g, "");
    const desc = cell(rows[i], 1);
    if (!codigo && !desc) continue;
    if (fold(codigo) === "ITEM") continue;
    const preco = money(rows[i]?.[3]);
    const situacao = cell(rows[i], 4) || (preco == null ? "Sem valor informado" : "Tabela");
    items.push({
      codigo: codigo || "—",
      descricao: desc || codigo,
      preco,
      situacao,
      foldDesc: fold(desc || codigo),
    });
  }
  return { items, valorHora };
}

/**
 * LPU TELEMONT 1 — preços Neutra (CHAVE | REGIONAL | CLIENTE | ATIVIDADE | V.U. TETO).
 * Só itens de INSTALAÇÃO REDE NEUTRA / correlatos usados no financeiro Neutra.
 */
export function parseLpuTelemont1(rows: unknown[][]): {
  items: LpuItem[];
  comDrop: number | null;
  semDrop: number | null;
  mesh: number | null;
  retirada: number | null;
} {
  const items: LpuItem[] = [];
  let comDrop: number | null = null;
  let semDrop: number | null = null;
  let mesh: number | null = null;
  let retirada: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const chave = cell(rows[i], 0);
    const atividade = cell(rows[i], 3);
    if (!chave && !atividade) continue;
    if (fold(chave) === "CHAVE") continue;
    const preco = money(rows[i]?.[4]);
    const desc = chave || atividade;
    const fd = fold(desc);
    items.push({
      codigo: chave.slice(0, 24) || "—",
      descricao: desc,
      preco,
      situacao: preco == null ? "Sem valor informado" : "Tabela",
      foldDesc: fd,
    });
    if (fd.includes("COM REAPROVEITAMENTO DE DROP")) comDrop = preco;
    else if (fd.includes("SEM REAPROVEITAMENTO DE DROP")) semDrop = preco;
    else if (fd.includes("REDE MESH") || fd.includes("INSTALACAO REDE MESH"))
      mesh = preco;
    else if (fd === "RETIRADA" || fd.startsWith("RETIRADA")) retirada = preco;
  }
  return { items, comDrop, semDrop, mesh, retirada };
}

/** Menor preço positivo da LPU Desconexão (entrega de controle). */
export function menorPrecoDesconexao(items: LpuItem[]): number | null {
  let min: number | null = null;
  for (const it of items) {
    if (it.preco == null || it.preco <= 0) continue;
    if (min == null || it.preco < min) min = it.preco;
  }
  return min;
}

/**
 * Preço operacional Desconexão (regras VALORES / briefing C.1) usando preços LPU.
 * Retorna código LPU representativo + preço.
 */
export function precoDesconexaoPorServico(
  servicoRaw: string,
  lpu: LpuItem[],
  menor: number | null,
): { codigo: string; descricao: string; preco: number | null; sem_preco: boolean } {
  const u = fold(servicoRaw);
  if (!u || u.includes("SMART CARD")) {
    return {
      codigo: "—",
      descricao: servicoRaw || "SMART CARD",
      preco: null,
      sem_preco: true,
    };
  }
  const find = (pred: (it: LpuItem) => boolean) => lpu.find(pred);

  if (u.includes("CONTROLE") || u.includes("ENTREGA DE CONTROLE")) {
    const it =
      find((x) => x.foldDesc.includes("VAS VIA MOTO") && x.foldDesc.includes("AGREGADA")) ||
      find((x) => x.preco === menor);
    return {
      codigo: it?.codigo || "min",
      descricao: it?.descricao || "Menor valor LPU (entrega de controle)",
      preco: menor,
      sem_preco: menor == null,
    };
  }
  if (u.includes("REINSTAL")) {
    const it =
      find((x) => x.foldDesc.includes("ENTREGA EXPRESS KIT")) ||
      find((x) => x.preco === 30);
    return {
      codigo: it?.codigo || "reinst",
      descricao: it?.descricao || "REINSTALAÇÃO (= instalação)",
      preco: it?.preco ?? 30,
      sem_preco: false,
    };
  }
  if (u.includes("TROCA")) {
    const it = find(
      (x) =>
        x.foldDesc.includes("REVERSA") && x.foldDesc.includes("DESLOCAMENTO"),
    );
    return {
      codigo: it?.codigo || "20.21",
      descricao: it?.descricao || "20.21-ENTREGA COM REVERSA — DESLOCAMENTO",
      preco: it?.preco ?? 31.9,
      sem_preco: false,
    };
  }
  if (u.includes("INSTAL")) {
    const it =
      find((x) => x.foldDesc.includes("ENTREGA EXPRESS KIT")) ||
      find((x) => x.preco === 30);
    return {
      codigo: it?.codigo || "20.14",
      descricao: it?.descricao || "INSTALAÇÃO",
      preco: it?.preco ?? 30,
      sem_preco: false,
    };
  }
  if (u.includes("DESCON") || u.includes("RETIR")) {
    const it = find((x) => x.foldDesc.includes("RETIRAR EQUIPAMENTO"));
    return {
      codigo: it?.codigo || "20.4",
      descricao: it?.descricao || "20.4-RETIRAR EQUIPAMENTO",
      preco: it?.preco ?? 41.5,
      sem_preco: false,
    };
  }
  // Desconhecido → 41,50 com aviso (regra VALORES)
  const it = find((x) => x.foldDesc.includes("RETIRAR EQUIPAMENTO"));
  return {
    codigo: it?.codigo || "20.4",
    descricao: `${servicoRaw || "SERVIÇO DESCONHECIDO"} → padrão retirada`,
    preco: it?.preco ?? 41.5,
    sem_preco: false,
  };
}

export type IatEndClass = "CASA" | "APTO" | "";

/** Complemento: APT/BL/TOR = apto; CASA = casa. */
export function iatEndClass(complemento: string): IatEndClass {
  const c = fold(complemento);
  if (/APT|\bBL\b|TORRE|\bTOR\b|SALA|LOJA|\bLJ\b|EDIFIC/.test(c))
    return "APTO";
  if (c.includes("CASA")) return "CASA";
  return "";
}

/** Célula Tipo O.S real: "43 - ADESAO - …" (ignora lixo de coluna). */
export function parseToaOs(
  osRaw: string,
): { code: number; desc: string; raw: string } | null {
  const raw = String(osRaw || "").trim();
  const m = raw.match(/^\s*(\d+)\s*[-–—]\s*(.*)$/);
  if (!m) return null;
  return { code: Number(m[1]), desc: fold(m[2] || ""), raw };
}

function byCodigo(lpu: LpuItem[], codigo: string): LpuItem | null {
  const want = codigo.replace(/\s/g, "");
  return lpu.find((it) => it.codigo.replace(/\s/g, "") === want) || null;
}

/**
 * Escolhe CASA/APTO pelo complemento.
 * NI (sem APT/BL/TOR/CASA): usa CASA como padrão operacional e o caller pode contar no aviso.
 */
function pickCasaApto(
  lpu: LpuItem[],
  casaCode: string,
  aptoCode: string,
  end: IatEndClass,
): LpuItem | null {
  const casa = byCodigo(lpu, casaCode);
  const apto = byCodigo(lpu, aptoCode);
  if (end === "APTO") return apto || casa;
  // CASA ou NI → CASA
  return casa || apto;
}

function pickDeslocAgreg(
  lpu: LpuItem[],
  deslocCode: string,
  agregCode: string,
  firstTask: boolean,
): LpuItem | null {
  const d = byCodigo(lpu, deslocCode);
  const a = byCodigo(lpu, agregCode);
  if (firstTask) return d || a;
  return a || d;
}

export type IatPricedOs = {
  toaCode: number;
  toaRaw: string;
  codigo: string;
  descricao: string;
  preco: number | null;
  sem_preco: boolean;
  motivo_sem?: string;
};

/**
 * Precifica lista de Tipo O.S de um contrato (ordem = 1ª deslocamento, demais agregada).
 * Regras Debora 17/11: casa/apto no complemento; 43 na adesão 1/51 (absorvida — não empilha 2,3);
 * 43 sozinha = Acesso Virtua 2,4/2,5; 45 na mudança 12/54 → 4,9; chip 208→13,1; retorno 69→−81,66.
 */
export function priceIatOsList(
  osRawList: string[],
  complemento: string,
  lpu: LpuItem[],
): IatPricedOs[] {
  const end = iatEndClass(complemento);
  const parsed = osRawList
    .map(parseToaOs)
    .filter(Boolean) as Array<{ code: number; desc: string; raw: string }>;
  const sibling = new Set(parsed.map((p) => p.code));
  const hasAdesao = sibling.has(1) || sibling.has(51);
  const out: IatPricedOs[] = [];

  parsed.forEach((p, idx) => {
    // 43/44 na mesma OS de adesão 1/51 → absorvida (evita PayTV + ponto Virtua em dobro)
    if (
      hasAdesao &&
      (p.code === 43 || p.code === 44)
    ) {
      return;
    }
    const first = idx === 0;
    const line = mapToaCode(p, sibling, end, first, lpu);
    out.push(line);
  });
  return out;
}

function mapToaCode(
  p: { code: number; desc: string; raw: string },
  sibling: Set<number>,
  end: IatEndClass,
  firstTask: boolean,
  lpu: LpuItem[],
): IatPricedOs {
  const base = (item: LpuItem | null, motivo: string): IatPricedOs => {
    if (!item) {
      return {
        toaCode: p.code,
        toaRaw: p.raw,
        codigo: String(p.code),
        descricao: p.raw,
        preco: null,
        sem_preco: true,
        motivo_sem: motivo,
      };
    }
    if (item.preco == null) {
      return {
        toaCode: p.code,
        toaRaw: p.raw,
        codigo: item.codigo,
        descricao: item.descricao,
        preco: null,
        sem_preco: true,
        motivo_sem: `LPU ${item.codigo} sem valor informado`,
      };
    }
    return {
      toaCode: p.code,
      toaRaw: p.raw,
      codigo: item.codigo,
      descricao: item.descricao,
      preco: item.preco,
      sem_preco: false,
    };
  };

  // --- mapeamento por código TOA ---
  switch (p.code) {
    // Adesão assinatura (TOA 1). Virtua vai na tarefa 43 à parte — não empilhar PayTV+Virtua aqui.
    case 1: {
      const withFone =
        sibling.has(95) ||
        sibling.has(83) ||
        p.desc.includes("NET FONE") ||
        p.desc.includes("VOIP");
      if (withFone || p.desc.includes("NET FONE")) {
        const it = pickCasaApto(lpu, "1,5", "1,6", end);
        return base(it, "adesão PayTV+Fone sem LPU");
      }
      if (p.desc.includes("VIRTUA") && p.desc.includes("PAYTV")) {
        const it = pickCasaApto(lpu, "1,3", "1,4", end);
        return base(it, "adesão PayTV+Virtua sem LPU");
      }
      // "ADESAO - INSTALACAO DE ASSINATURA" (truncado) → PayTV; ponto Virtua = TOA 43
      const it = pickCasaApto(lpu, "1,7", "1,8", end);
      return base(it, "adesão PayTV sem LPU");
    }
    case 51: {
      const it = pickCasaApto(lpu, "1,7", "1,8", end);
      return base(
        it,
        end ? "adesão digital sem LPU" : "adesão digital: complemento NI",
      );
    }
    // 43 sozinha (sem adesão 1/51) → Acesso Virtua CASA/APTO (2,4/2,5)
    case 43:
    case 44: {
      const acesso =
        lpu.find(
          (it) =>
            it.foldDesc.includes("ADESAO") &&
            it.foldDesc.includes("ACESSO VIRTUA") &&
            (end === "APTO"
              ? it.foldDesc.includes("APTO")
              : it.foldDesc.includes("CASA")),
        ) ||
        pickCasaApto(lpu, "2,4", "2,5", end) ||
        byCodigo(lpu, "2,3");
      return base(acesso, "acesso Virtua sem LPU 2,4/2,5");
    }
    // Mudança endereço assinatura (12). Ponto adicional Virtua = TOA 45 à parte.
    case 12: {
      const withFone = sibling.has(84) || p.desc.includes("NET FONE");
      if (withFone) {
        const it = pickCasaApto(lpu, "4,5", "4,6", end);
        return base(it, "mudança PayTV+Fone sem LPU");
      }
      if (p.desc.includes("VIRTUA") && p.desc.includes("PAYTV")) {
        const it = pickCasaApto(lpu, "4,3", "4,4", end);
        return base(it, "mudança PayTV+Virtua sem LPU");
      }
      const it = pickCasaApto(lpu, "4,7", "4,8", end);
      return base(it, "mudança PayTV sem LPU");
    }
    case 54: {
      const it = pickCasaApto(lpu, "4,7", "4,8", end);
      return base(
        it,
        end ? "mudança digital sem LPU" : "mudança digital: complemento NI",
      );
    }
    // 45 na mudança (12/54) → ponto adicional
    case 45:
      return base(
        byCodigo(lpu, "4,9"),
        "mudança ponto adicional sem LPU 4,9",
      );
    // Chip
    case 208:
      return base(byCodigo(lpu, "13,1"), "chip sem LPU 13,1");
    // Retorno credenciada (desconto)
    case 69:
      return base(
        byCodigo(lpu, "7,9") || byCodigo(lpu, "7,1"),
        "retorno credenciada sem LPU 7,9",
      );
    // Mudança de pacote
    case 24:
      return base(
        pickDeslocAgreg(lpu, "4,31", "4,32", firstTask),
        "mudança de pacote sem LPU 4,31/4,32",
      );
    case 57:
      return base(
        pickDeslocAgreg(lpu, "4,27", "4,28", firstTask),
        "mudança pacote digital sem LPU 4,27/4,28",
      );
    // Mudança local de ponto (LPU 4,29 desloc / 4,3 agregada — código 4,3 duplicado na aba)
    case 15: {
      const desloc = lpu.find(
        (it) =>
          it.foldDesc.includes("MUDANCA DE LOCAL DE PONTO") &&
          it.foldDesc.includes("DESLOCAMENTO"),
      );
      const agreg = lpu.find(
        (it) =>
          it.foldDesc.includes("MUDANCA DE LOCAL DE PONTO") &&
          it.foldDesc.includes("AGREGAD"),
      );
      const it = firstTask ? desloc || agreg : agreg || desloc;
      return base(it || null, "mudança local ponto sem LPU");
    }
    // Reinstalação / refazer
    case 33:
      return base(byCodigo(lpu, "4,19"), "reinstalação sem LPU 4,19");
    case 31:
      return base(
        pickCasaApto(lpu, "4,16", "4,17", end) || byCodigo(lpu, "4,16"),
        "refazer instalação sem LPU",
      );
    case 46:
      return base(byCodigo(lpu, "4,2"), "reinstalação ponto adicional sem LPU 4,2");
    // Streaming
    case 516:
    case 517:
    case 514:
      return base(
        pickDeslocAgreg(lpu, "1,71", "1,72", firstTask),
        "streaming sem LPU 1,71/1,72",
      );
    // VOIP / Net Fone pontos
    case 83:
    case 95:
      return base(byCodigo(lpu, "3,7"), "ponto Net Fone sem LPU 3,7");
    case 84:
      return base(
        byCodigo(lpu, "6,13"),
        "mudança ponto Net Fone sem LPU 6,13",
      );
    case 101:
      return base(byCodigo(lpu, "3,7"), "ponto portabilidade sem LPU");
    default:
      break;
  }

  // Fallback: match por descrição (+ CASA/APTO + desloc/agreg)
  return matchByDescription(p, end, firstTask, lpu);
}

function matchByDescription(
  p: { code: number; desc: string; raw: string },
  end: IatEndClass,
  firstTask: boolean,
  lpu: LpuItem[],
): IatPricedOs {
  const descPart = p.desc;
  if (!descPart) {
    return {
      toaCode: p.code,
      toaRaw: p.raw,
      codigo: String(p.code),
      descricao: p.raw,
      preco: null,
      sem_preco: true,
      motivo_sem: "sem descrição TOA",
    };
  }

  let candidates = lpu.filter((it) => {
    if (!it.foldDesc) return false;
    if (it.foldDesc.includes(descPart)) return true;
    if (descPart.includes(it.foldDesc) && it.foldDesc.length >= 12) return true;
    const tokens = descPart.split(" ").filter((t) => t.length > 3);
    if (tokens.length < 2) return false;
    return tokens.every((t) => it.foldDesc.includes(t));
  });

  if (end && candidates.length > 1) {
    const narrowed = candidates.filter((it) => it.foldDesc.includes(end));
    if (narrowed.length) candidates = narrowed;
  }

  const hasPair = candidates.some((c) => c.foldDesc.includes("DESLOCAMENTO"));
  if (hasPair && candidates.length > 1) {
    const want = firstTask ? "DESLOCAMENTO" : "AGREGAD";
    const narrowed = candidates.filter((it) => it.foldDesc.includes(want));
    if (narrowed.length) candidates = narrowed;
  }

  if (candidates.length === 1) {
    const item = candidates[0];
    return {
      toaCode: p.code,
      toaRaw: p.raw,
      codigo: item.codigo,
      descricao: item.descricao,
      preco: item.preco,
      sem_preco: item.preco == null,
      motivo_sem:
        item.preco == null ? `LPU ${item.codigo} sem valor informado` : undefined,
    };
  }
  if (candidates.length > 1) {
    const priced = candidates.filter((c) => c.preco != null);
    if (priced.length === 1) {
      const item = priced[0];
      return {
        toaCode: p.code,
        toaRaw: p.raw,
        codigo: item.codigo,
        descricao: item.descricao,
        preco: item.preco,
        sem_preco: false,
      };
    }
    return {
      toaCode: p.code,
      toaRaw: p.raw,
      codigo: String(p.code),
      descricao: p.raw,
      preco: null,
      sem_preco: true,
      motivo_sem: `ambíguo LPU (${candidates.length} candidatos)`,
    };
  }
  return {
    toaCode: p.code,
    toaRaw: p.raw,
    codigo: String(p.code),
    descricao: p.raw,
    preco: null,
    sem_preco: true,
    motivo_sem: `TOA ${p.code} sem casamento LPU`,
  };
}

/** Compat: um OS isolado (sem irmãos / índice 0). */
export function matchLpuIat(
  osRaw: string,
  lpu: LpuItem[],
  complemento: string,
): { item: LpuItem | null; ambiguous: boolean } {
  const lines = priceIatOsList([osRaw], complemento, lpu);
  if (!lines.length) return { item: null, ambiguous: false };
  const line = lines[0];
  if (line.sem_preco) {
    return {
      item: null,
      ambiguous: Boolean(line.motivo_sem?.includes("ambíguo")),
    };
  }
  const item = byCodigo(lpu, line.codigo);
  return { item, ambiguous: false };
}
