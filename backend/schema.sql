PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'instructor', 'admin')),
    token_version INTEGER NOT NULL DEFAULT 0 CHECK(token_version >= 0),
    profile_photo_data TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_notifications_enabled IN (0, 1)),
    in_app_notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK(in_app_notifications_enabled IN (0, 1)),
    share_usage_data INTEGER NOT NULL DEFAULT 0 CHECK(share_usage_data IN (0, 1))
);

CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK(difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 600),
    pass_percent REAL NOT NULL CHECK(pass_percent BETWEEN 0 AND 100),
    negative_marking REAL NOT NULL DEFAULT 0 CHECK(negative_marking BETWEEN 0 AND 100),
    attempt_limit INTEGER NOT NULL DEFAULT 1 CHECK(attempt_limit BETWEEN 1 AND 100),
    availability_start TEXT,
    availability_end TEXT,
    prerequisites TEXT NOT NULL DEFAULT '',
    randomize_questions INTEGER NOT NULL DEFAULT 0 CHECK(randomize_questions IN (0, 1)),
    review_answers INTEGER NOT NULL DEFAULT 0 CHECK(review_answers IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK(availability_start IS NULL OR availability_end IS NULL OR availability_start < availability_end)
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL CHECK(length(prompt) BETWEEN 1 AND 5000),
    question_type TEXT NOT NULL CHECK(question_type IN ('mcq', 'multiple_select', 'true_false', 'short_answer')),
    correct_answers_json TEXT NOT NULL,
    marks REAL NOT NULL CHECK(marks > 0 AND marks <= 1000),
    explanation TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    difficulty TEXT NOT NULL CHECK(difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    category TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_assessment ON questions(assessment_id, position);
CREATE TABLE IF NOT EXISTS question_options (
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    option_text TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY(question_id, option_id),
    UNIQUE(question_id, position)
);

CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    assessment_id INTEGER NOT NULL REFERENCES assessments(id),
    started_at REAL NOT NULL,
    deadline_at REAL NOT NULL,
    submitted_at REAL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'submitted', 'expired')),
    score REAL,
    score_percent REAL,
    passed INTEGER CHECK(passed IN (0, 1)),
    correct_count INTEGER,
    incorrect_count INTEGER,
    unanswered_count INTEGER,
    UNIQUE(id, assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON attempts(assessment_id, started_at DESC);

CREATE TABLE IF NOT EXISTS attempt_questions (
    attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    position INTEGER NOT NULL,
    PRIMARY KEY(attempt_id, question_id),
    UNIQUE(attempt_id, position)
);
CREATE TABLE IF NOT EXISTS responses (
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_json TEXT NOT NULL,
    saved_at REAL NOT NULL,
    PRIMARY KEY(attempt_id, question_id),
    FOREIGN KEY(attempt_id, question_id) REFERENCES attempt_questions(attempt_id, question_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY,
    certificate_id TEXT NOT NULL UNIQUE,
    attempt_id INTEGER NOT NULL UNIQUE REFERENCES attempts(id),
    issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    revoked_at TEXT,
    revoked_by INTEGER REFERENCES users(id),
    revocation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_certificates_id ON certificates(certificate_id);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    read_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    assessment_id INTEGER REFERENCES assessments(id),
    question_id INTEGER REFERENCES questions(id),
    attempt_id INTEGER REFERENCES attempts(id),
    kind TEXT NOT NULL CHECK(kind IN ('question', 'result')),
    message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'reviewing', 'resolved')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY COLLATE NOCASE);
INSERT OR IGNORE INTO categories(name) VALUES
    ('Python'), ('Java'), ('JavaScript'), ('TypeScript'), ('C'), ('C++'), ('C#'),
    ('Go'), ('Rust'), ('Kotlin'), ('Swift'), ('PHP'), ('Ruby'), ('Dart'), ('R'),
    ('Scala'), ('SQL'), ('Web Development'), ('Frontend Development'),
    ('Backend Development'), ('Node.js'), ('React'), ('Flutter'), ('Databases'),
    ('Data Structures'), ('Algorithms'), ('AI/ML'), ('Cybersecurity'), ('DevOps'),
    ('Cloud Computing'), ('UI/UX');
