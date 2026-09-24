-- =====================================================
-- DSM Glosowanie v2 — schemat Postgres (bez Supabase)
-- Uruchamiane automatycznie przez scripts/migrate.js
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Użytkownicy: login + hash hasła (scrypt), brak kodów w plain-texcie
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

-- Komisje / działy / Ogólne
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'komisja' CHECK (type IN ('komisja','dzial','ogolne')),
  icon TEXT NOT NULL DEFAULT 'gen',
  color TEXT NOT NULL DEFAULT '#F2C14E',
  position INT NOT NULL DEFAULT 0
);

-- Przypisania radny <-> jednostka, rola: member / chair / vice (wiceprzewodniczący)
CREATE TABLE IF NOT EXISTS memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','chair','vice')),
  PRIMARY KEY (user_id, unit_id)
);
-- Migracja istniejących baz (member/chair -> member/chair/vice)
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('member','chair','vice'));

-- Głosowania: jedno aktywne na jednostkę, lista uprawnionych zamrożona
CREATE TABLE IF NOT EXISTS votings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  question TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  voting_type TEXT NOT NULL DEFAULT 'classic' CHECK (voting_type IN ('classic','single_choice','multi_choice')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_votes_per_user INT NOT NULL DEFAULT 1,
  eligible_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_votings_unit_active ON votings(unit_id, is_active);

-- Głosy: BEZ voted_at (tajność — brak korelacji czasowej z voted_status)
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voting_id UUID NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  choice TEXT,
  choices JSONB,
  CONSTRAINT choice_or_choices_present CHECK (choice IS NOT NULL OR choices IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_votes_voting ON votes(voting_id);

-- Kto zagłosował (osobna tabela, ze stemplem czasowym do frekwencji)
CREATE TABLE IF NOT EXISTS voted_status (
  voting_id UUID NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (voting_id, user_id)
);

-- Dziennik zdarzeń (aplikacja prawna)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ DEFAULT now(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);

-- E-mail radnego jest opcjonalny (nie każdy chce go podawać).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;

-- Tokeny resetu hasła. Przechowujemy HASH tokenu, nie sam token
-- (tak samo jak hasła — żeby wyciek bazy nie dawał gotowych linków resetu).
CREATE TABLE IF NOT EXISTS password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);
