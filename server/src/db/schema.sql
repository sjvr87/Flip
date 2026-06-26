-- Flip multiverse Phase 1 schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    did TEXT NOT NULL UNIQUE,
    handle TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flip_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS external_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    handle TEXT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    expires_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, provider, handle)
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_text TEXT NOT NULL DEFAULT '',
    media_type TEXT,
    media_uri TEXT,
    flip_post_uri TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_deliveries (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    destination_account_id TEXT REFERENCES external_accounts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    remote_post_id TEXT,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    next_attempt_at TEXT,
    idempotency_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_external_accounts_user ON external_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_post ON post_deliveries(post_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON post_deliveries(status, next_attempt_at);
