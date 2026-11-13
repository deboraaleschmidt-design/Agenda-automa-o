import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://127.0.0.1:3000";
const TOKEN = "dev-local-token";
const MEDIA = "/cursor/stores/bc-f6389db8-3abd-443e-aa61-b1ad7f0bc4d1/media";
const ART = "/opt/cursor/artifacts";

mkdirSync(MEDIA, { recursive: true });
mkdirSync(ART, { recursive: true });

async function shot(page, name) {
  const dest = join(MEDIA, name);
  await page.screenshot({ path: dest, fullPage: false });
  copyFileSync(dest, join(ART, name));
  console.log("saved", dest);
}

async function waitLive(page) {
  await page.waitForSelector(".live-banner, .kpi-value, .ops-title", {
    timeout: 120000,
  });
  // wait network settle a bit for sheets
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

// Establish session cookie via API
const res = await context.request.post(`${BASE}/api/session`, {
  data: { token: TOKEN },
});
if (!res.ok()) {
  console.error("session failed", await res.text());
  process.exit(1);
}

const page = await context.newPage();

await page.goto(`${BASE}/painel?mes=2026-11`, { waitUntil: "networkidle" });
await waitLive(page);
await shot(page, "etapa3-painel-nov-cards.png");
await shot(page, "etapa3-header-segmentos-desconexao.png");

await page.goto(`${BASE}/iat?mes=2026-11`, { waitUntil: "networkidle" });
await waitLive(page);
await shot(page, "etapa3-header-segmentos-iat.png");

await page.goto(`${BASE}/financeiro?mes=TOTAL&segmento=todos`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(4000);
await shot(page, "etapa3-financeiro-total-todos.png");
await shot(page, "etapa3-header-segmentos-financeiro.png");

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=desconexao`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "etapa3-financeiro-nov-desconexao.png");

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=iat`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "etapa3-financeiro-nov-iat.png");

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=todos`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "etapa3-financeiro-nov-todos.png");

await browser.close();
console.log("done");
