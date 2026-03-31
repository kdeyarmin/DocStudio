# Doc Studio Playwright Runner

A standalone Node.js/Express service that executes Documentation Studio automation workflows using Playwright. It receives job dispatches from the `doc-studio-playwright` Supabase edge function, runs the workflow steps against a live browser, and posts results back via the `doc-studio-jobs` edge function callback.

## How it fits in the architecture

```
Frontend (WorkflowsIndex)
  → useTriggerJob → AutomationProviderFactory
    → PlaywrightAutomationProvider
      → doc-studio-playwright edge function (dispatches job)
        → POST /run  (this service)
          → WorkflowRunner → StepExecutor → ActionHandlers
          → AssetUploader  → Supabase Storage + documentation_assets
          → POST callback_url (doc-studio-jobs edge function)
            → job status / step_results / events written to DB
              → Frontend polls / realtime subscription updates UI
```

## Setup

```bash
# Install dependencies
npm install

# Install Chromium
npm run install-browsers

# Configure environment
cp .env.example .env
# Edit .env with your values

# Development (ts-node)
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `3456`) |
| `PLAYWRIGHT_RUNNER_SECRET` | Yes (prod) | Bearer token matching the Supabase secret `PLAYWRIGHT_RUNNER_SECRET` |
| `SUPABASE_URL` | Yes | Supabase project URL for asset uploads |
| `STORAGE_BUCKET` | No | Storage bucket name (default: `doc-studio-assets`) |
| `DEMO_ACCOUNT_USERNAME` | Yes (if auth) | Shared username for demo/staging accounts |
| `DEMO_ACCOUNT_PASSWORD` | Yes (if auth) | Password for the default demo account |

For multiple demo accounts, add a variable per `env_password_key` configured on each `documentation_demo_accounts` row.

## Endpoints

### `GET /health`
Returns `{ ok: true, active_jobs: N, active_job_ids: [...] }`.

### `POST /run`
Starts a workflow run. Requires `Authorization: Bearer <secret>`.

**Body** (sent by the edge function):
```json
{
  "job_id": "uuid",
  "workflow": { "id": "...", "name": "...", "start_url": "/...", "steps": [...] },
  "demo_account": null,
  "settings": { "playwright_base_url": "https://...", "headless": true, ... },
  "callback_url": "https://<project>.supabase.co/functions/v1/doc-studio-jobs",
  "callback_token": "<supabase-service-role-key>"
}
```

**Response:** `{ "accepted": true, "job_id": "..." }` — the job runs in the background.

### `POST /cancel`
Signals a running job to stop after the current step. Requires `Authorization: Bearer <secret>`.

**Body:** `{ "job_id": "uuid" }`

## Step Action Types

| Action | Behaviour |
|---|---|
| `visit_url` | Navigate to `action_value` or `target_selector` |
| `click` | Click the resolved locator |
| `type` | Fill input with `action_value` |
| `select` | Select option by `action_value` |
| `hover` | Hover over element |
| `keypress` | Press keyboard key (`action_value`) |
| `wait` | Apply the step's `wait_strategy` |
| `assert_text` | Check element inner text contains `action_value` |
| `assert_url` | Check current URL contains `action_value` |
| `extract_text` | Read element inner text into `extracted_text` |
| `screenshot` | No-op (screenshot taken via `screenshot_checkpoint` flag) |
| `upload_file` | Set file input to `action_value` path |
| `conditional_branch` | No-op (reserved for future use) |

## Selector Strategies

| Strategy | Playwright method |
|---|---|
| `css` (default) | `page.locator(selector)` |
| `xpath` | `page.locator('xpath=...')` |
| `text` | `page.getByText(selector)` |
| `testid` | `page.getByTestId(selector)` |
| `role` | `page.getByRole(role, { name })` — format: `role\|name` |

## Deployment

Run this service anywhere that has network access to your staging/demo environment and can be reached by your Supabase project. Suitable options:

- A small VM or container alongside your staging environment
- Docker container on a private network
- Railway, Fly.io, Render with a persistent volume for `/tmp`

Set the public URL of this service as `playwright_runner_url` in Doc Studio Settings. Set `PLAYWRIGHT_RUNNER_SECRET` as a Supabase Edge Function secret so the edge function can authenticate its requests.
