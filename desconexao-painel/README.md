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
- `/neutra` — Neutra (PROMPT + BASE, dedupe SA)
- `/financeiro` — Financeiro

## Endpoints

- `POST /api/session` — `{ "token": "…" }` → cookie httpOnly
- `GET /api/painel?mes=YYYY-MM` — cookie ou Bearer
- `GET /api/iat?mes=YYYY-MM|TOTAL`
- `GET /api/historico-tecnico`
- `GET /api/retornos`
- `GET /api/neutra?mes=YYYY-MM|TOTAL`
- `GET /api/financeiro?mes=YYYY-MM|TOTAL`
- `POST /api/sync` — cookie ou Bearer; rate limit 3 / 5 min por IP
