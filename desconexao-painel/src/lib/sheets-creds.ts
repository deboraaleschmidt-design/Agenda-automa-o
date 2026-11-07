/** Validate GOOGLE_SERVICE_ACCOUNT_JSON without logging its contents. */
export function inspectServiceAccountJson(raw: string | undefined): {
  ok: boolean;
  reason?: string;
  parsed?: { client_email: string; private_key: string };
} {
  const creds = raw?.trim() ?? "";
  if (!creds) {
    return {
      ok: false,
      reason:
        "Secret GOOGLE_SERVICE_ACCOUNT_JSON vazio. Cole o JSON completo da conta de serviço (arquivo baixado no Google Cloud).",
    };
  }
  const lower = creds.toLowerCase();
  if (
    lower === "not now" ||
    lower === "secret value" ||
    lower === "placeholder" ||
    !creds.startsWith("{")
  ) {
    return {
      ok: false,
      reason:
        'O secret GOOGLE_SERVICE_ACCOUNT_JSON está inválido (ex.: texto "Not now"). Substitua pelo JSON real da service account no painel Secrets do Cursor.',
    };
  }
  try {
    const parsed = JSON.parse(creds) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      return {
        ok: false,
        reason:
          "JSON da service account incompleto (faltam client_email ou private_key).",
      };
    }
    return {
      ok: true,
      parsed: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      },
    };
  } catch {
    return {
      ok: false,
      reason:
        "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido. Cole o conteúdo inteiro do arquivo .json da conta de serviço.",
    };
  }
}
