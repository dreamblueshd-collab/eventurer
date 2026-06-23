# Event-Management

Backend API for Event Management platform using Node.js, Express, and SQL Server.

## Branch Strategy

- `development`: active development + staging/testing
- `main`: production-ready branch and live deployment source

Recommended flow:

1. Develop features in short-lived feature branches from `development`.
2. Merge feature branches into `development` via Pull Request.
3. Promote `development` to `main` after QA/UAT and deploy from `main`.

## CI/CD (GitHub Actions)

### CI

Workflow file: `.github/workflows/ci.yml`

Triggers:

- Push to `development`, `main`
- Pull request to `development`, `main`

Actions:

1. Install dependencies (`npm install`)
2. Run lint placeholder (non-blocking if script is missing)
3. Run tests (`npm run test:ci`)

### CD

Workflow file: `.github/workflows/cd.yml`

Triggers:

- Push to `main`
- Manual dispatch

Actions:

1. Build and verify package
2. Prepare deployment artifact
3. Upload artifact (for release/deploy pipeline consumption)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy safe environment template and fill secrets:

```bash
cp .env.example .env
```

3. Run migration:

```bash
npm run migrate
```

Optional database audit:

```bash
npm run db:doctor
npm run db:audit:envs
```

4. Start app:

```bash
npm run dev
```

## Security Notes

- Real secret files are ignored via `.gitignore` (`.env.*`).
- Keep only `.env.example` in repository.
- Never commit production credentials.

## Current Audit Status

- Admin CRUD notifications have been standardized to toast on the remaining legacy pages.
- Survey configuration runtime now uses `EventConfiguration` consistently.
- Multi-environment schema audit on 2026-06-19 confirmed:
  - `DEV` is the cleanest baseline currently reachable
  - `PROD` matches `DEV` on core CRUD columns but still needs constraint-level follow-up
  - `GCP` still differs on `Events.AssignedAdminId` and needs baseline constraint repair before full sync
  - `Surveys.RequireApproval` is now added as the form-level source of truth and backfilled from `Events.RequireApproval`
  - `LOCAL` could not be verified because local SQL Server was not reachable
