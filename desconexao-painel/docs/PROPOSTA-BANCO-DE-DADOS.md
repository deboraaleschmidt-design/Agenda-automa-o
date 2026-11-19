# Proposta — Banco de dados (DESCONEXÃO / T.ESTRATÉGICO)

> Path pedido `app/PROPOSTA-…` movido para `docs/` — um diretório `app/` na raiz do Next.js sobrescreve `src/app/` e quebra o painel.

## Opção A (adotada) — estender o Postgres do app

O `desconexao-painel` já declara `{ "database": "postgres" }` em `cursor-app.json`, usa `src/lib/db.ts` (`pg` + PGlite local) e `migrations/` + `scripts/migrate.mjs` no build.

**Esta opção estende esse mesmo banco** com tabelas operacionais. Planilhas (D-1 / Desconexão / LPU) continuam a **fonte só-leitura**; o Postgres guarda espelho tipado para histórico, fechamento de mês e consultas rápidas.

### Tabelas (migration `002_opcao_a_operacional.sql`)

| Tabela | Conteúdo | `ano_mes` |
|---|---|---|
| `tecnicos` | nome, PJ/CLT, logins TT/TR, área, situação — **sem CPF/PII** | sim + índice |
| `tecnico_vinculo_hist` | histórico de mudança PJ/CLT com vigência | sim + índice |
| `atividades` | IAT / Desconexão / Neutra (upsert por segmento+Número SA) | sim + índice |
| `retornos` | retornos | sim + índice |
| `lpu_precos` | valor unitário com vigência | sim + índice |
| `snapshots_diarios` / `snapshots_mensais` | agregados; `fechado` no mensal | sim + índice |
| `sync_runs` | auditoria de sync (botão / cron) | sim + índice |

`painel_snapshots` (Slice 1) ganha coluna `ano_mes` (espelho de `mes`).

### Sync

- Leitura Sheets via service account (env); **nunca** grava na planilha.
- Botão **Sincronizar** (`POST /api/sync`) e cron 07:00 (`POST /api/cron/sync` com o mesmo token).
- Upsert sem duplicar chaves naturais.
- Ao terminar o mês civil, `snapshots_mensais.fechado = true`.

### Opção B (não adotada)

Banco separado / warehouse externo. Fora do escopo do publish-app atual.

## Neutra histórica

App lê **PROMPT NEUTRA → BASE NEUTRA HIST → BASE NEUTRA**, dedupe por **Número SA** (**1ª ocorrência vence**). Aceite TCI concluídas = produtivas + improdutivas (bate com ou sem PROMPT).
