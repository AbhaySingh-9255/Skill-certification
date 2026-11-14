# SkillCert Pro

SkillCert Pro is an online skills assessment and certification application. The maintained product path is a Flutter Web client, a Flask JSON API, and a SQLite database. The original React/Vite prototype remains in the repository; it is legacy UI and is not the authenticated product client.

## Existing project and implementation status

The original repository contained a React/Vite starter with a mock login, an in-browser quiz with client-side scoring, hard-coded dashboard metrics, and a browser-generated certificate. It did not contain a Flask API, a database, or authentication/authorization. Those demo interactions are not used by the Flutter product flow.

The new implementation provides:

- Student registration/login, scrypt password hashing, signed expiring bearer tokens, token invalidation on logout/password change, profile editing, and role checks in Flask.
- A normalized, foreign-key constrained SQLite schema with idempotent initialization and an additive token-version migration.
- Searchable and paginated published assessment catalog; instructor/admin assessment creation, publication, unpublishing, archiving, and ownership enforcement.
- Server-held answer keys; MCQ, multiple-select, true/false, and short-answer API question types; server-persisted responses; server-owned deadline and scoring; duplicate-submit idempotency.
- Student dashboard data, active attempt resume, result history, notifications, certificate PDFs, public certificate verification, and admin revocation/audit records.
- Instructor performance summaries; administrator metrics, users/roles, attempts, reports, certificate review, and authenticated CSV export.
- Optional server-side Groq question generation and an explicit offline draft generator. Generated questions remain drafts and require human review.
- Responsive Flutter layouts, loading/error/empty states, catalog filters, an assessment-taking flow, reports navigation, certificate verification, and a role-aware administration workspace.

## Prerequisites

- Windows 10/11 and PowerShell.
- Python 3.10 or newer (tested here with Python 3.14.7).
- Flutter stable and Dart (tested here with Flutter 3.47.7 / Dart 3.13.5).
- A current Chrome or Edge browser.
- Node.js/npm only if you also want to run the retained React prototype.

## Setup (PowerShell)

From the project root:

```powershell
python --version
flutter --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Push-Location flutter_client
flutter pub get
Pop-Location
```

The API reads `backend\.env` for local secrets and configuration. Copy `backend\.env.example` to `backend\.env`, then set your values. The actual `.env` file is git-ignored. Generate a fresh local signing secret; do not commit it or put it in Flutter `--dart-define` arguments:

```powershell
Copy-Item backend\.env.example backend\.env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Paste the generated signing secret into `SKILLCERT_SECRET_KEY` in `backend\.env`. Gemini is the configured question-generation provider: create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), set it as `GEMINI_API_KEY`, and optionally change `GEMINI_MODEL`. Gemini keys are separate from Groq keys; `AI_API_KEY` is only used when `AI_PROVIDER=groq`. Never put a provider key in Flutter, browser configuration, or source control. The API reports a clear configuration error when the selected provider has no key; it does not silently substitute generic placeholder questions. `AI_PROVIDER=offline` is available for disconnected development only and returns review placeholders, not real topic-specific questions.

Instructors can enter any technical topic or language as the assessment category (for example, Rust, Go, Kubernetes, or SQL), choose a question count from 1 to 100, and generate those draft questions in one action. Larger requests are split into bounded provider batches; the generated set is validated and returned together for review. Generated questions require human review before use.

Learners can also create a student account or sign in from the React dashboard, then generate a fresh practice quiz by choosing a technical topic, difficulty, and 1–100 questions. The authenticated `POST /api/practice/questions/generate` route uses the selected provider's server-side key and returns practice-only questions with explanations for an answer review after completion. Practice quiz generation is limited to 20 successfully generated quizzes per account per hour; failed provider attempts do not consume the limit, and a limit response includes a retry time. Dashboard settings support profile updates, password changes, and locally saved theme and density preferences. The quiz requests browser fullscreen and logs fullscreen exits and focus changes; learners can leave with confirmation, which discards the current attempt. Websites cannot disable browser extensions, so this is a deterrent rather than a secure proctoring system. Passing the client-scored practice quiz (70% or higher) also enables a downloadable practice-completion certificate; it is not an accredited or independently verified credential.

### Initialize the database and create the first administrator

Database tables and default categories are initialized idempotently when the Flask app starts. No existing application database was present in this workspace to migrate. An existing database file is not deleted; initialization only adds missing tables and the additive `token_version` column when needed.

Open a separate PowerShell terminal at the project root after creating and configuring `backend\.env`, then run:

```powershell
.\.venv\Scripts\python.exe backend\create_admin.py
```

The script asks for an admin name, email, and password interactively; it does not create a default account or print credentials. It loads the backend settings from `backend\.env`.

## Start the applications

### Terminal 1 — Flask API

From the project root, ensure `backend\.env` is configured, then:

```powershell
.\.venv\Scripts\python.exe backend\app.py
```

The API binds to `127.0.0.1:5000`. Check readiness at `http://127.0.0.1:5000/api/health`.

### Terminal 2 — Flutter Web

From the project root:

```powershell
Push-Location flutter_client
flutter run -d web-server --web-hostname 0.0.0.0 --web-port 8080 `
  --dart-define=API_BASE_URL=http://127.0.0.1:5000/api `
  --dart-define=PUBLIC_WEB_URL=http://localhost:8080
```

Open `http://localhost:8080`. Register a student account in the UI. Instructors/admins are provisioned through the admin user-role screen; the first administrator is created with the interactive script above. Do not use real passwords in screenshots or demo environments.

For a production-style static build:

```powershell
Push-Location flutter_client
flutter build web --release `
  --dart-define=API_BASE_URL=https://your-api.example/api `
  --dart-define=PUBLIC_WEB_URL=https://your-app.example
Pop-Location
```

## API overview

All endpoints are rooted at `/api`; protected routes require `Authorization: Bearer <token>`. The API reloads the current user and role from SQLite on every protected request.

| Area | Routes |
|---|---|
| Health/auth/profile | `GET /health`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`, `PUT /profile` |
| Catalog/categories | `GET /categories`, `POST /categories` (admin), `GET /assessments`, `GET /assessments/<id>` |
| Assessment management | `GET/POST /management/assessments`, `GET/PUT /management/assessments/<id>`, `PATCH /management/assessments/<id>/status`, `DELETE /management/assessments/<id>`, `GET /management/assessments/<id>/performance` |
| Question generation | `POST /management/questions/generate` (instructor/admin; draft-only, human review required) |
| Attempts/results | `POST /assessments/<id>/attempts`, `GET /attempts/active`, `GET /attempts/<id>`, `PUT /attempts/<id>/responses`, `POST /attempts/<id>/submit`, `GET /results`, `GET /dashboard` |
| Certificates | `GET /certificates`, public `GET /certificates/verify/<id>`, public `GET /certificates/<id>/pdf` |
| Student support | `GET /notifications`, `PATCH /notifications/<id>/read`, `POST /reports` |
| Administration | `GET /admin/metrics`, `GET /admin/audit-logs`, `GET /admin/users`, `PATCH /admin/users/<id>/role`, `GET /admin/attempts`, `GET /admin/certificates`, `GET /admin/reports`, `PATCH /admin/reports/<id>`, `POST /admin/certificates/<id>/revoke`, `GET /admin/export/attempts.csv` |

Errors use `{ "error": { "message": "..." } }`; catalog/admin list routes use bounded page/per-page pagination. The public verification endpoint returns only the credential recipient name, assessment, issue date, score, ID, and valid/revoked status—not email or account details.

## Tests and build checks

From the project root:

```powershell
Push-Location backend
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
Pop-Location

Push-Location flutter_client
flutter analyze
flutter test
flutter build web --release `
  --dart-define=API_BASE_URL=http://127.0.0.1:5000/api `
  --dart-define=PUBLIC_WEB_URL=http://localhost:8080
Pop-Location
```

The retained React prototype can be checked separately with `npm run lint` and `npm run build`.

## Troubleshooting

- **API refuses to start:** set `SKILLCERT_SECRET_KEY` in the same PowerShell process that starts `backend\app.py`.
- **CORS error:** `FRONTEND_ORIGIN` must exactly match the browser origin (scheme, host, and port). The documented Flutter origin is `http://localhost:8080`.
- **Gemini quiz generation reports a key or model error:** verify that `AI_PROVIDER=gemini`, that `GEMINI_API_KEY` is an active Google AI Studio key, and that `GEMINI_MODEL` is available to your project. Restart Flask after changing backend settings.
- **The web app shows an API connection error:** ensure Flask is running on port `5000` and the configured API base URL points to a host reachable from the browser. For physical devices, `127.0.0.1` points at the device, not the development PC.
- **Admin setup fails:** set the same database and secret environment variables used by the API, and run the creation script once per administrator.
- **Database lock/permission errors:** stop other app processes using the SQLite file and ensure the API account can write its folder. SQLite WAL mode is enabled.

## Known limitations and hardening

- The React/Vite files are retained as a prototype; the supported app flow is Flutter Web. React practice results are not server-validated qualifications or certifications.
- The assessment editor creates single-question, four-option MCQs and can edit/delete only assessments matching that editor shape. The API accepts the other question types, but bulk editing/import/export, a full question-bank UI, scheduled-availability controls, and short-answer manual grading are not yet exposed in Flutter.
- Password recovery by email is not configured; account password change requires the existing password.
- Rate limits are process-local and do not coordinate across multiple workers. Production deployment needs a shared rate-limit store, TLS, secure host/reverse-proxy configuration, backups, monitoring, retention policies, and an operational secret-management system.
- Browser timing and save/submit enforcement are server-side, but browser-only proctoring cannot prevent outside assistance or guarantee cheating prevention.
- The offline question generator creates clearly labeled generic review drafts; it is not a subject-matter substitute. AI output must be reviewed before use.
- SQLite is appropriate for local/single-node use. For concurrent multi-instance production workloads, plan a reviewed migration to a managed database.
- This repository has not been penetration-tested or deployment-hardened. Do not represent it as production-secure without those steps.
