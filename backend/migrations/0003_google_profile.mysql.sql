ALTER TABLE users
    ADD COLUMN google_sub VARCHAR(255) NULL,
    ADD COLUMN full_name VARCHAR(120) NULL,
    ADD COLUMN avatar_url VARCHAR(500) NULL,
    ADD UNIQUE INDEX ix_users_google_sub (google_sub);