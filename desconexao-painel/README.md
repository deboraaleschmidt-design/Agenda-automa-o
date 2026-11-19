# DESCONEXÃO — Painel ao vivo (Slice 1)

API + painel web (path B). Tenant público: **T.ESTRATÉGICO**. Auth: Bearer ou cookie httpOnly (sem token na URL).

## Local

```bash
npm install
env -u DATABASE_URL npm run dev
```

Abrir http://127.0.0.1:3000/painel e digitar `dev-local-token` (só quando `PAINEL_API_TOKEN` e `DATABASE_URL` estão ausentes).

## Secrets (publish-app)

- `PAINEL_API_TOKEN` — **obrigatório em produção** (sem fallback)
- `GOOGLE_SERVICE_ACCOUNT_JSON_V2` — service account (leitura; sem fallback para o nome antigo)
- `GOOGLE_SHEETS_ID` — opcional

## Rotas (hub)

- `/` — segmentos T.ESTRATÉGICO
- `/painel` — Desconexão
- `/iat` — IAT (meses SET+OUT+NOV desde 22/09 + TOTAL)
- `/historico-tecnico` — cards por técnico (aba HISTÓRICO TÉCNICO)
- `/retornos` — retornos (aba RETORNOS; substitui Retorno Credenciada)
- `/neutra` — Neutra (PROMPT > HIST > BASE, 1ª SA vence; AGO–NOV)
- `/financeiro` — Financeiro (Neutra inclui SET/OUT)
- `/banco` — espelho Postgres (opção A): sync + snapshots mensais

## Período (Mês + Ano + TOTAL)

Todas as páginas de dados usam `PeriodoVisaoSelector`:

- **Ano:** `TOTAL` · `2026` · `2027` (+ anos presentes nos dados)
- **Mês:** `TOTAL` · `JAN`…`DEZ` (com Ano=TOTAL o mês fica só TOTAL)
- Query `mes=` aceita `TOTAL` | `YYYY` | `YYYY-MM`
- Retornos filtram pela **data do retorno**
- Financeiro aplica o período em atividades IAT/Neutra/Desconexão, faturamento e bloco de quinzena exibido

## Exportação — viabilidade

Dois modos pedidos (Debora 18/11):

| Modo | O quê | Status agora |
|---|---|---|
| **(b) Tratado** | Visão filtrada pelo período (o que a tela mostra) → CSV | **Implementado** no cliente: botão **Exportar CSV** em `/retornos` e `/financeiro` (só dados já carregados com a sessão; sem nova chamada Sheets; sem secret no browser) |
| **(a) Cru** | Mesmo layout das bases (Neutra=BASE/PROMPT; IAT=BASE IAT; Desconexão=formulário) → CSV/XLSX | **Documentado / fase 2** — ver abaixo |

### Abordagem recomendada (modo a — ainda não ligado)

1. Rota server-side autenticada (`PAINEL_API_TOKEN` / cookie), ex. `GET /api/export?recurso=iat|neutra|desconexao&modo=cru|tratado&formato=csv|xlsx&mes=…`
2. Reutilizar `sheetsAuthOrNull()` + IDs só via env (`GOOGLE_SHEETS_*`); **nunca** devolver a service account nem o JSON ao cliente
3. Rate limit + mesmo gate de sessão das demais APIs
4. XLSX: lib server-only (ex. `exceljs`) gerando buffer; CSV: escape UTF-8 BOM

### Riscos

- Bases cruas têm **dados de clientes** (endereço, contrato, telefone…) → export cru só para gestoras; logar quem baixou; considerar watermark / audit
- Volume (PROMPT NEUTRA dezenas de milhares de linhas) → stream/paginar; timeout
- XLSX aumenta deps e superfície; CSV cobre 90% do uso operacional

## Endpoints

- `POST /api/session` — `{ "token": "…" }` → cookie httpOnly
- `GET /api/painel?mes=TOTAL|YYYY|YYYY-MM` — cookie ou Bearer
- `GET /api/iat?mes=TOTAL|YYYY|YYYY-MM`
- `GET /api/historico-tecnico`
- `GET /api/retornos`
- `GET /api/neutra?mes=TOTAL|YYYY|YYYY-MM`
- `GET /api/financeiro?mes=TOTAL|YYYY|YYYY-MM`
- `GET /api/banco` — status do espelho Postgres
- `POST /api/sync` — cookie ou Bearer; painel + banco (upsert); rate limit
- `POST /api/cron/sync` — mesmo token; agendar 07:00 America/Sao_Paulo

## Banco (opção A)

Proposta: [`docs/PROPOSTA-BANCO-DE-DADOS.md`](docs/PROPOSTA-BANCO-DE-DADOS.md) (path `app/` conflita com o App Router em `src/app/`).

- `cursor-app.json` → `{ "database": "postgres" }`
- `src/lib/db.ts` — `pg` se `DATABASE_URL`; senão PGlite em memória
- Migrations: `001_init.sql`, `002_opcao_a_operacional.sql` (tecnicos sem CPF/PII, atividades, retornos, LPU com vigência, snapshots, sync_runs; **`ano_mes` indexado**)
- Build: `next build && node scripts/migrate.mjs`
- Sync só-leitura das planilhas; botão Sincronizar + cron; upsert; fecha mês civil ao terminar
