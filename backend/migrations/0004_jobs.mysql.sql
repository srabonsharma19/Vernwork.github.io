CREATE TABLE jobs (
    id INT NOT NULL AUTO_INCREMENT,
    owner_id INT UNSIGNED NOT NULL,
    title VARCHAR(180) NOT NULL,
    category VARCHAR(40) NOT NULL,
    description TEXT NOT NULL,
    budget DECIMAL(12, 2) NOT NULL,
    budget_type VARCHAR(20) NOT NULL DEFAULT 'Fixed price',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_jobs_owner_id (owner_id),
    KEY ix_jobs_created_at (created_at),
    CONSTRAINT fk_jobs_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);