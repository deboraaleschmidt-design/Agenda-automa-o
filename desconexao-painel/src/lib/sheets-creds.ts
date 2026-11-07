/** Validate GOOGLE_SERVICE_ACCOUNT_JSON without logging its contents. */

export type CredsShape =
  | "empty"
  | "placeholder"
  | "not_object"
  | "invalid_json"
  | "incomplete"
  | "ok";

export type CredsLengthClass = "empty" | "short" | "long";

const PLACEHOLDER_REASONS =
  'Valor de GOOGLE_SERVICE_ACCOUNT_JSON inválido (ex.: "Not now"). Em My Secrets: Delete esse secret → Add Secrets com o mesmo nome → cole o JSON que começa com { → salve → confirme o Publish do app (o valor só entra no deploy) → Sincronizar uma vez.';

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
      reason:
        "Secret GOOGLE_SERVICE_ACCOUNT_JSON vazio. Cole o JSON completo da conta de serviço (arquivo baixado no Google Cloud) e republiche o app.",
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
      reason:
        "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido. Cole o conteúdo inteiro do arquivo .json da conta de serviço e republiche o app.",
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
      reason:
        "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido. Cole o conteúdo inteiro do arquivo .json da conta de serviço e republiche o app.",
    };
  }
}
