-- Opção A: estende o Postgres do app (sem CPF / PII).
-- Fact tables carregam ano_mes indexado; sync só-leitura a partir das planilhas.

ALTER TABLE painel_snapshots
  ADD COLUMN IF NOT EXISTS ano_mes TEXT;

UPDATE painel_snapshots SET ano_mes = mes WHERE ano_mes IS NULL;

CREATE INDEX IF NOT EXISTS painel_snapshots_ano_mes_idx
  ON painel_snapshots (ano_mes);

-- Técnicos / equipe (nome, PJ/CLT, logins) — sem CPF nem dados pessoais sensíveis.
CREATE TABLE IF NOT EXISTS tecnicos (
  id UUID PRIMARY KEY,
  segmento TEXT NOT NULL DEFAULT 'geral',
  nome TEXT NOT NULL,
  vinculo TEXT NOT NULL DEFAULT '',
  login_tt TEXT NOT NULL DEFAULT '',
  login_tr TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT '',
  ano_mes TEXT NOT NULL DEFAULT 'TOTAL',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, login_tt, ano_mes)
);

CREATE INDEX IF NOT EXISTS tecnicos_ano_mes_idx ON tecnicos (ano_mes);
CREATE INDEX IF NOT EXISTS tecnicos_segmento_ano_mes_idx ON tecnicos (segmento, ano_mes);

-- Histórico de mudança PJ/CLT (vigência).
CREATE TABLE IF NOT EXISTS tecnico_vinculo_hist (
  id UUID PRIMARY KEY,
  tecnico_ref TEXT NOT NULL,
  segmento TEXT NOT NULL DEFAULT 'geral',
  vinculo TEXT NOT NULL,
  vigente_de DATE NOT NULL,
  vigente_ate DATE,
  ano_mes TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, tecnico_ref, vigente_de)
);

CREATE INDEX IF NOT EXISTS tecnico_vinculo_hist_ano_mes_idx
  ON tecnico_vinculo_hist (ano_mes);

-- Atividades IAT / Desconexão / Neutra (1 linha por chave natural).
CREATE TABLE IF NOT EXISTS atividades (
  id UUID PRIMARY KEY,
  segmento TEXT NOT NULL,
  numero_sa TEXT NOT NULL,
  data_exec DATE,
  estado TEXT NOT NULL DEFAULT '',
  macro TEXT NOT NULL DEFAULT '',
  tecnico_login TEXT NOT NULL DEFAULT '',
  tecnico_nome TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ano_mes TEXT NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'sheets',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, numero_sa)
);

CREATE INDEX IF NOT EXISTS atividades_ano_mes_idx ON atividades (ano_mes);
CREATE INDEX IF NOT EXISTS atividades_segmento_ano_mes_idx
  ON atividades (segmento, ano_mes);

-- Retornos
CREATE TABLE IF NOT EXISTS retornos (
  id UUID PRIMARY KEY,
  numero_chave TEXT NOT NULL,
  data_retorno DATE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ano_mes TEXT NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'sheets',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero_chave)
);

CREATE INDEX IF NOT EXISTS retornos_ano_mes_idx ON retornos (ano_mes);

-- LPU / valor unitário com vigência
CREATE TABLE IF NOT EXISTS lpu_precos (
  id UUID PRIMARY KEY,
  segmento TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco NUMERIC(12, 2),
  vigente_de DATE NOT NULL,
  vigente_ate DATE,
  ano_mes TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, codigo, vigente_de)
);

CREATE INDEX IF NOT EXISTS lpu_precos_ano_mes_idx ON lpu_precos (ano_mes);

-- Snapshots diários / mensais
CREATE TABLE IF NOT EXISTS snapshots_diarios (
  id UUID PRIMARY KEY,
  segmento TEXT NOT NULL,
  dia DATE NOT NULL,
  ano_mes TEXT NOT NULL,
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, dia)
);

CREATE INDEX IF NOT EXISTS snapshots_diarios_ano_mes_idx
  ON snapshots_diarios (ano_mes);

CREATE TABLE IF NOT EXISTS snapshots_mensais (
  id UUID PRIMARY KEY,
  segmento TEXT NOT NULL,
  ano_mes TEXT NOT NULL,
  fechado BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segmento, ano_mes)
);

CREATE INDEX IF NOT EXISTS snapshots_mensais_ano_mes_idx
  ON snapshots_mensais (ano_mes);

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  ano_mes TEXT NOT NULL DEFAULT 'TOTAL'
);

CREATE INDEX IF NOT EXISTS sync_runs_ano_mes_idx ON sync_runs (ano_mes);
