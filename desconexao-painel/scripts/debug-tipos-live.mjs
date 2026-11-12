import { google } from "googleapis";

async function main() {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_V2?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    "";
  if (!raw) {
    console.log("no SA env");
    process.exit(1);
  }
  const parsed = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  for (const opt of ["UNFORMATTED_VALUE", "FORMATTED_VALUE"]) {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: "1vpdyJ2zalgu913_XRP-vtUaJXpSsrSpdydWAbFZOeWU",
      ranges: ["PAINEL!A55:P75"],
      valueRenderOption: opt,
    });
    const rows = res.data.valueRanges?.[0]?.values || [];
    console.log("\n===", opt, "rows", rows.length);
    rows.forEach((r, i) => console.log(i, JSON.stringify(r)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
