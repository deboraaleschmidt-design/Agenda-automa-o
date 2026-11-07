-- Slice 1 schema: multi-tenant + reserved setor for future modules

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY,
  nome_interno TEXT,
  nome_publico TEXT NOT NULL,
  spreadsheet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS painel_snapshots (
  id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  setor TEXT NOT NULL DEFAULT 'desconexao',
  mes TEXT NOT NULL,
  payload JSONB NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'fixture',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, setor, mes)
);

CREATE INDEX IF NOT EXISTS painel_snapshots_empresa_mes_idx
  ON painel_snapshots (empresa_id, mes);

-- Optional future auth table (login out of Slice 1)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gestor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, email)
);
