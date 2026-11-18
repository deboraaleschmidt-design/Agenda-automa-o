import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://127.0.0.1:3000";
const TOKEN = process.env.PAINEL_API_TOKEN || "dev-local-token";
const MEDIA = "/cursor/stores/bc-f6389db8-3abd-443e-aa61-b1ad7f0bc4d1/media";
const ART = "/opt/cursor/artifacts";

mkdirSync(MEDIA, { recursive: true });
mkdirSync(ART, { recursive: true });

async function shot(page, name, full = false) {
  const dest = join(MEDIA, name);
  await page.screenshot({ path: dest, fullPage: full });
  copyFileSync(dest, join(ART, name));
  console.log("saved", dest);
}

async function waitLive(page) {
  await page.waitForSelector(".live-banner, .kpi-value, .ops-title", {
    timeout: 180000,
  });
  await page.waitForTimeout(3500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

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
await page.waitForTimeout(2000);
await shot(page, "fin-opex-ranking-desconexao-nov.png");
await shot(page, "fin-opex-ranking-desconexao-nov-full.png", true);

await page.goto(`${BASE}/iat?mes=2026-11`, { waitUntil: "networkidle" });
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "fin-opex-iat-nov-16.png");
await shot(page, "fin-opex-iat-nov-16-full.png", true);

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=neutra`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(4000);
await shot(page, "fin-opex-neutra-nov-viewport.png");
await shot(page, "fin-opex-neutra-nov-full.png", true);

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=iat`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "fin-opex-iat-fin-nov-viewport.png");
await shot(page, "fin-opex-iat-fin-nov-full.png", true);

await page.goto(`${BASE}/financeiro?mes=2026-11&segmento=desconexao`, {
  waitUntil: "networkidle",
});
await waitLive(page);
await page.waitForTimeout(3000);
await shot(page, "fin-opex-desconexao-nov-viewport.png");
await shot(page, "fin-opex-desconexao-nov-full.png", true);

await browser.close();
console.log("done");
