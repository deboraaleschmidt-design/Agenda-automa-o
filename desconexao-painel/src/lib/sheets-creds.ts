/**
 * Validate Google SA JSON without logging contents.
 * Runtime env name (V2 only — no fallback to GOOGLE_SERVICE_ACCOUNT_JSON).
 */
export const SHEETS_SA_SECRET_NAME = "GOOGLE_SERVICE_ACCOUNT_JSON_V2" as const;

export type CredsShape =
  | "empty"
  | "placeholder"
  | "not_object"
  | "invalid_json"
  | "incomplete"
  | "ok";

export type CredsLengthClass = "empty" | "short" | "long";

/** Read only V2. Never falls back to GOOGLE_SERVICE_ACCOUNT_JSON. */
export function readServiceAccountJsonEnv(): string | undefined {
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON_V2;
}

const PLACEHOLDER_REASONS =
  `Valor de ${SHEETS_SA_SECRET_NAME} inválido (ex.: "Not now"). Em My Secrets: edite ou recrie ${SHEETS_SA_SECRET_NAME} com o JSON que começa com { → salve → confirme o Publish do app (o valor só entra no deploy) → Sincronizar uma vez.`;

export function classifyServiceAccountJson(raw: string | undefined): {
  shape: CredsShape;
  startsWithBrace: boolean;
  lengthClass: CredsLengthClass;
} {
  const creds = raw?.trim() ?? "";
  const startsWithBrace = creds.startsWith("{");
  const lengthClass: CredsLengthClass =
    creds.length === 0 ? "empty" : creds.length < 50 ? "short" : "long";

  if (!creds) {
    return { shape: "empty", startsWithBrace, lengthClass };
  }

  const lower = creds.toLowerCase();
  if (
    lower === "not now" ||
    lower === "secret value" ||
    lower === "placeholder" ||
    !startsWithBrace
  ) {
    return { shape: "placeholder", startsWithBrace, lengthClass };
  }

  try {
    const parsed = JSON.parse(creds) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      return { shape: "incomplete", startsWithBrace, lengthClass };
    }
    return { shape: "ok", startsWithBrace, lengthClass };
  } catch {
    return { shape: "invalid_json", startsWithBrace, lengthClass };
  }
}

export function inspectServiceAccountJson(raw: string | undefined): {
  ok: boolean;
  reason?: string;
  shape: CredsShape;
  parsed?: { client_email: string; private_key: string };
} {
  const classified = classifyServiceAccountJson(raw);
  const creds = raw?.trim() ?? "";

  if (classified.shape === "empty") {
    return {
      ok: false,
      shape: "empty",
      reason: `Secret ${SHEETS_SA_SECRET_NAME} vazio. Cole o JSON completo da conta de serviço (arquivo baixado no Google Cloud) e republiche o app.`,
    };
  }

  if (classified.shape === "placeholder") {
    return {
      ok: false,
      shape: "placeholder",
      reason: PLACEHOLDER_REASONS,
    };
  }

  if (classified.shape === "invalid_json") {
    return {
      ok: false,
      shape: "invalid_json",
      reason: `${SHEETS_SA_SECRET_NAME} não é um JSON válido. Cole o conteúdo inteiro do arquivo .json da conta de serviço e republiche o app.`,
    };
  }

  if (classified.shape === "incomplete") {
    return {
      ok: false,
      shape: "incomplete",
      reason:
        "JSON da service account incompleto (faltam client_email ou private_key).",
    };
  }

  try {
    const parsed = JSON.parse(creds) as {
      client_email: string;
      private_key: string;
    };
    return {
      ok: true,
      shape: "ok",
      parsed: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      },
    };
  } catch {
    return {
      ok: false,
      shape: "invalid_json",
      reason: `${SHEETS_SA_SECRET_NAME} não é um JSON válido. Cole o conteúdo inteiro do arquivo .json da conta de serviço e republiche o app.`,
    };
  }
}
