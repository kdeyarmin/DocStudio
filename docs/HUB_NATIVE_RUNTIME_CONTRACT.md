# Hub-owned DocStudio authoring and rendering

Status: target and contract reviewed by the coordinated release owner,
2026-09-11. No schema or worker has been deployed by this work.

## Verified starting point

- Standalone source is `kdeyarmin/DocStudio` main
  `663ecfb`, whose original import names CMbackup
  `37724b8f29494f6bacb5c99691d12a296ca6647c`.
- The complete DocStudio Git history contains the video-compositions migration
  but omits its core schema. The original CMbackup commit contains 52 relevant
  March schema, seed, repair and policy files. Recovery must use their final
  column contracts without replaying example rows or obsolete policies.
- The native EMR project `ubbtgcaosuebrlwcvihw` has 1,185 public tables but no
  `doc_studio_drafts`, `documentation_jobs`, `documentation_assets`,
  `doc_studio_render_projects`, or `doc_studio_render_jobs`. Schema-only checks
  found the same missing relations in the other three accessible projects.
  Missing tables must produce an unavailable response, never an empty inventory.
- Deployed native code exists: draft v38, jobs v49, render v29, export v39,
  FFmpeg executor v16, Remotion executor v15. Their presence does not establish
  saved projects, a functioning queue, or completed media.
- FFmpeg v16 invokes an OS process and accepts a caller-supplied command plan.
  Remotion v15 simulates progress and derives public URLs without creating the
  requested video. Both rely on gateway JWT checks without native job/role
  authorization in the handler. Neither is an acceptable Hub render writer.
- CMbackup's `20260509000000_drop_doc_studio_artifacts.sql` deliberately removes
  DocStudio tables, policies, functions and buckets because the feature was
  removed from EMR. Recreating these tables there would undo that separation.
- New DocStudio work therefore belongs to the Hub's private schema and existing
  SMS/content-editor authority. The EMR/Go administrator mapping is unrelated
  to this new Hub-owned material and remains a separate pending configuration.

## Minimum usable workflow

The Hub lists authorized saved drafts, opens exact saved content, creates and
edits a draft, submits it for review, and tracks durable rendering jobs.
An approved saved revision can be exported to the existing Hub publication
importer with exact Markdown or MP4, VTT, and transcript bytes. The importer
continues to own catalog publication and product placement.

Adapt the canonical draft, asset, scene, review, render-project, render-job,
render-event, and render-artifact contracts into the Hub. Add revision-bound command
receipts and durable worker leases as explicit new contracts. Historical fake
completed examples, demo-account passwords, generated workflow assignments, and
reviewer approvals are excluded. Historical FKs to EMR organizations/profiles
are replaced with actual Hub product scopes and profiles; native record IDs are
never reinterpreted as Hub identities. No historical projects are fabricated.

## Hub authorization and commands

Every authoring call uses the current opaque Hub SMS session and existing
`content.write` permission for every affected product. Existing product scopes
are also checked when an edit removes placements. The server exposes a closed
API and invokes fixed database functions. No Supabase verification, native
browser session, email-based role mapping, or arbitrary table RPC is introduced.

Initial closed operations:

| Operation | Input | Output and effect |
| --- | --- | --- |
| `runtime.readiness` | No resource identifier | Exact schema/worker availability; no provider secret values |
| `drafts.list` | Bounded cursor, optional exact organization | Draft IDs, titles, status, revision, timestamps; no assets or free-form job logs |
| `drafts.get` | Exact draft UUID | Saved editable content and authorized asset metadata, without public media URLs |
| `jobs.list` | Exact draft UUID, bounded cursor | Job status, progress, lease health, output counts |
| `export.preview` | Draft UUID and expected revision | Saved approval, exact content digest, output availability |
| `commands.preview` | Closed draft/edit/review/render command | Short-lived review of exact current state; no write |
| `commands.apply` | Reviewed preview, expected revision, stable request UUID | Atomic Hub writer and durable receipt; retries recover the original result |
| `assets.read` | Exact approved asset UUID and revision | Private bounded bytes through the Hub server; no arbitrary URL fetching |

Fresh state is checked on apply, export, retry and worker completion. A new SMS
session may recover its same Hub actor's prior command after new review;
it must not recreate a job or attribute the original write to an observer.
Editing approved content invalidates approval and any queued export review.

## Database and legacy separation

New tables live in the Hub's private schema with RLS and no browser, service-role
or raw application-role access. Only narrowly granted functions write them.
The application and any worker database role must be NOSUPERUSER/NOBYPASSRLS.
The worker receives a dedicated bounded transport credential, never a native
EMR service-role key, browser session, or unrestricted database credential.

Existing EMR endpoints stay unused and their removed schema stays absent. The
Hub does not forward calls to either legacy executor. Its worker protocol accepts
neither filesystem paths, shell flags, arbitrary destinations, nor claimed
completion from the browser. Future generation services must use the same
writer and permissions before their capabilities are enabled.

## Actual render worker

A dedicated Node worker runs the existing DocStudio TutorialVideo composition
through Remotion and validates its real FFmpeg output in a pinned container.
The Hub server authorizes and enqueues work; it does not run a second provider
pipeline. Container dependencies follow the official
[Remotion Docker guidance](https://www.remotion.dev/docs/docker).
The worker claims an immutable manifest with a renewable lease, stages only
authorized private assets in a job directory, renders using server-built
arguments, probes the generated output, and writes exact private output bytes.

Completion requires validated nonzero MP4 output, measured duration, valid VTT,
the reviewed transcript, byte lengths and SHA-256 digests. A crash or lost
lease cannot mark a job complete. Cancellation, bounded retry and stale worker
completion use conditional transitions. Provider credentials remain server
only; no generation is certified operational without a configured provider.

## Release checks

1. Review the source-derived migration, exact SQL hash and service-role grants.
2. Run actual PostgreSQL isolation, revision, command-retry, lease, cancellation,
   approval-invalidation and output-completion tests.
3. Render a synthetic fixture with actual FFmpeg/Remotion and validate the
   exported bytes. Fake progress is not an acceptable fixture for completion.
4. Run repository checks and build the production worker container.
5. Apply exact reviewed Hub SQL and deploy the protected Hub API and worker.
   Enable rendering only after worker readiness.
6. Verify owner reads through the existing Hub SMS session.
   Use synthetic local/CI assets for writes; no arbitrary customer projects,
   public publications, SMS sends or provider charges are production tests.
