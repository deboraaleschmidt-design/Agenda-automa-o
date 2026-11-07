# DESCONEXÃO — Painel ao vivo (Slice 1)

API + painel web (path B). Tenant público: **T.ESTRATÉGICO**. Auth: Bearer token.

## Local

```bash
npm install
npm run dev
```

Token local padrão: `dev-local-token`  
Abrir: http://127.0.0.1:3000/painel?token=dev-local-token

## Secrets (publish-app)

- `PAINEL_API_TOKEN` — token do link privado
- `GOOGLE_SERVICE_ACCOUNT_JSON` — JSON da service account (somente leitura)
- `GOOGLE_SHEETS_ID` — opcional; default da planilha piloto

Sem credencial Sheets o app serve fixture e banner “aguardando credencial Sheets”.

## Endpoints

- `GET /api/painel?mes=YYYY-MM` — Bearer token
- `POST /api/sync?mes=YYYY-MM` — sync Sheets → Postgres (ou fixture)
