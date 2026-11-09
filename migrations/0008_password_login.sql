ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN password_window_until INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_users_password_email ON users (lower(email)) WHERE password_hash IS NOT NULL;

ALTER TABLE sessions ADD COLUMN password_setup_until INTEGER;
