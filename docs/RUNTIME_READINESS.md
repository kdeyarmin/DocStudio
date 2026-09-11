# DocStudio runtime and dependency review

Reviewed on 2026-09-11 from repository main `84b424b`. This is a source and read-only service inventory, not a deployment record or authorization to reuse another application's credentials.

## Dependency remediation

The original application lockfile reports 24 npm findings: 1 critical, 13 high, 7 moderate and 3 low. The critical `loader-utils` path comes through Remotion's build tooling. Browser and development dependencies also have advisories, including DOMPurify, React Router and Vite. Severity labels describe the packages; they do not establish that every advisory is exploitable in this frontend. For example, several Router advisories concern SSR features that this Vite SPA does not use.

The updated compatible graph reports **zero findings**, including development dependencies. No `--force` or major-version upgrade was used. Important direct versions are:

| Package | Previous installed | Updated installed |
| --- | --- | --- |
| `remotion`, `@remotion/player`, `@remotion/cli` | 4.0.443 | 4.0.523 |
| `dompurify` | 3.3.3 | 3.4.15 |
| `react-router-dom` | 7.13.2 | 7.18.3 |
| `vite` | 7.3.1 | 7.3.6 |
| `postcss` | 8.5.8 | 8.5.28 |
| `@supabase/supabase-js` | 2.101.1 | 2.101.1 (unchanged, now pinned) |

All three Remotion packages are pinned to the same exact version, as required by [Remotion's version guidance](https://www.remotion.dev/docs/version-mismatch). The maintained Vite 7 patch includes the [Windows filesystem protection fix](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff). Other compatible transitive updates remove the vulnerable archive loader, WebSocket and build-parser paths. The application CI now runs `npm audit --prefix app --audit-level=high` after its frozen install so a future high or critical finding is visible.

Reproduce with `npm ci --prefix app`, `npm audit --prefix app`, the root typecheck/lint/build commands, and `npm run test:support-hub-contract`. This review covers `app/package-lock.json`; the root and Playwright runner currently have no lockfiles, so an exact historical runner dependency audit is not reproducible. Root `npm ci` therefore fails with `ENOLOCK`; the documented root `npm install` also performs mutable installs in both subprojects. The application CI uses the existing app lockfile directly.

## Verified hosting and native authority

| Surface | Observed evidence | Implication |
| --- | --- | --- |
| GitHub repository | No homepage URL or deployment records; only export-contract/application CI; no deployment secret names in this repository | No production frontend location is established here. |
| Railway | No DocStudio-named project among the six accessible projects; known CareMetric Hub, Train, PennSite and Breathe services contain no DocStudio service | No dedicated DocStudio frontend/runner was found in these inspected CareMetric projects. Other hosting accounts are not ruled out. |
| Supabase local configuration | `supabase/config.toml` uses local label `docstudio`, localhost ports and no production reference; `.env.example` has placeholders | The standalone source is not bound to a production project. |
| Existing EMR backend | Read-only metadata for `ubbtgcaosuebrlwcvihw` shows 22 active `doc-studio-*` functions plus FFmpeg and Remotion executors | Native backend capability already exists in the EMR runtime; this does not prove current runner credentials, queue health or a usable frontend. |
| Live `doc-studio-draft` | Version 38, active, native gateway `verify_jwt=false`; downloaded source uses `supabase.auth.getUser(token)` and organization/draft authority | Gateway configuration does not mean anonymous access is allowed. Native handlers require their own real identity checks. |
| Native authority | Live `_shared/auth.ts` reads `profiles.is_super_admin` / `profiles.role` and verifies organization membership; draft organization is resolved from the stored draft | Do not infer grants from email equality, Hub metadata, or uploaded export governance. |
| Native browser origins | Live draft CORS helper names `caremetric.ai`, `app.caremetric.ai`, `www.caremetric.ai`, plus an exact configured `SITE_URL` / `APP_URL` | A new standalone origin needs explicit native configuration; it must not reuse or invent another application's session. |

No private records, native account rows, secret values or financial data were read for this inventory. No deployment, credential creation, identity mapping or native configuration was changed.

## Current usability gaps

The `/login` route is a static instruction to sign in through Supabase; it contains no sign-in control. `ProtectedRoute` consequently cannot bootstrap a new standalone user's session. The app uses its own `docstudio-auth` browser storage key, so opening it at another origin does not inherit an EMR or Hub browser session.

The environment instructions place `.env` at the repository root, but `npm run dev` changes directory to `app`, whose Vite configuration has no `envDir` override. An unconfigured client also constructs `createClient` with empty values. A successful static build therefore does not establish a usable, configured application.

The app has no reviewed production static server, SPA fallback, runtime configuration check, deployment workflow or native sign-in handoff. The Playwright runner's README describes an independent Express service and server-only credentials, but this review did not verify a live runner endpoint. Do not deploy the development server as a substitute or add a fake login to claim readiness.

## Native contract inventory for Hub integration

The approved local export added in PR 4 is distinct from native draft editing and native publication status. Hub publication imports independently check approved exact asset bytes, editor permissions, revision identity and explicit placement changes.

| Function/source | Current operations | Integration boundary |
| --- | --- | --- |
| `doc-studio-draft` | `list`, `get`, `create`, `update`, `delete`, `submit_review`, `publish`, `archive`, `create_asset`, `delete_asset`, `reorder_assets` | Organization and draft authority; native `publish` changes DocStudio lifecycle, not the Hub catalog. Broad native responses require a closed Hub projection. |
| `app/src/hooks/useDocStudio.ts` | Direct browser table reads/writes for drafts/reviews/assets, plus Storage uploads and `getPublicUrl` | The existing UI does not consistently use the Edge draft writer. A Hub adapter should reuse reviewed native services; do not forward arbitrary table queries or return native public media locators. |
| `doc-studio-review` | Workflow and dashboard reads; reviewer assignment; start/approve/request changes/advance stage; tasks, comments, change requests, checklists and AI insights | Approval and reviewer authority must remain native and current; source approval cannot grant Hub privilege. |
| `doc-studio-workflows`, `doc-studio-playwright`, `doc-studio-jobs` | Workflow configuration and dispatch; job list/get/events/assets; cancellation, completion and runner callbacks | Separate human commands from service callbacks. Dispatch can execute browser automation and requires explicit bounded native operation review. |
| `doc-studio-generate-content`, `doc-studio-ai-generate-all`, narration/scene/quality/integrity functions | AI generation, narration, assembly and review-support queues | Provider work and source content stay under native authorization; do not expose provider tokens, arbitrary destinations or callback credentials. |
| `doc-studio-render`, FFmpeg/Remotion executors | Project reads, render manifest construction and render execution | Readiness and queue state are different from a completed validated media asset. |
| `doc-studio-export`, `doc-studio-package`, `HubPublicationExport.tsx` | Native packaging and approved browser-local manifest/asset export | Saved draft authority and exact material are checked again before local export. Hub import remains the only writer of the resulting shared Hub publication revision. |

A governed Hub integration should keep the existing Hub SMS session and forward a short-lived, single-use, operation-bound capability to a fixed native EMR adapter. That adapter must resolve an explicit Hub-to-native identity mapping, check the current usable native account and protected native authority, and invoke a closed set of native operations. It must not mint a native browser session or use email matching as an authorization grant. Start with draft/queue metadata reads and an approved saved-export preview; separately review create/edit/review/generation commands and private asset delivery before enabling them. The verified native owner mapping and deployed adapter are still prerequisites, not inferred facts.
