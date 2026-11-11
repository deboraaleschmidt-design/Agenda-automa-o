import { google } from "googleapis";
import {
  inspectServiceAccountJson,
  readServiceAccountJsonEnv,
} from "./sheets-creds";

export function sheetsAuthOrNull() {
  const inspected = inspectServiceAccountJson(readServiceAccountJsonEnv());
  if (!inspected.ok || !inspected.parsed) {
    return { ok: false as const, reason: inspected.reason };
  }
  const key = inspected.parsed.private_key.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: inspected.parsed.client_email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return {
    ok: true as const,
    sheets: google.sheets({ version: "v4", auth }),
    email: inspected.parsed.client_email,
  };
}
