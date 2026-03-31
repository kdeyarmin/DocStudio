# Documentation Studio

**Documentation Studio** is a standalone application for creating, automating, and managing software documentation. It provides a full pipeline for generating screenshot guides, video tutorials, and narrated walkthroughs of web applications.

## Features

- **Draft Management** — Create and manage documentation drafts with full lifecycle support (draft → review → approved → published)
- **Playwright Automation** — Automated browser-based screenshot and video capture using Playwright
- **AI Content Generation** — Generate narration scripts, captions, and content using AI
- **Video Composition** — Assemble video tutorials with transitions, narration, and captions via Remotion
- **Audio Assembly** — Manage narration audio with pronunciation guides and timing synchronization
- **Review Workflow** — Multi-stage review pipeline with checklists, AI review, and approval workflows
- **Quality & Integrity** — Automated quality checks, drift detection, and integrity validation
- **PDF Generation** — Generate PDF documentation from templates with custom branding
- **Export & Packaging** — Export documentation in multiple formats with package manifests

## Architecture

```
DocStudio/
├── app/                        # React frontend (Vite + TypeScript + Tailwind)
│   └── src/
│       ├── components/doc-studio/  # UI components (~85 files)
│       ├── hooks/                  # 15 custom React hooks
│       ├── services/documentation/ # Business logic services
│       ├── types/                  # TypeScript type definitions
│       └── lib/                    # Shared libraries
│           ├── remotion/           # Video composition
│           ├── pdf/                # PDF generation
│           └── ffmpeg/             # Video processing
├── playwright-runner/          # Standalone Playwright automation service
│   └── src/
│       ├── server.ts              # Express API server
│       └── runner/                # Browser automation logic
└── supabase/
    └── functions/              # Supabase Edge Functions (~20 functions)
        └── doc-studio-*/       # Backend serverless functions
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 7, Tailwind CSS 3 |
| State Management | TanStack React Query v5 |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| Browser Automation | Playwright |
| Video | Remotion, FFmpeg |
| PDF | @react-pdf/renderer, jsPDF |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- Supabase account (or local Supabase via Docker)

### Installation

```bash
# Install all dependencies (workspace root)
npm install

# Install Playwright browsers (for the automation service)
cd playwright-runner && npx playwright install chromium && cd ..
```

### Environment Setup

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anonymous key
- `VITE_SITE_URL` — Site URL (e.g., `http://localhost:5173`)
- `VITE_APP_URL` — App URL (e.g., `http://localhost:5173`)

### Development

```bash
# Start the frontend dev server
npm run dev

# Start the Playwright runner (separate terminal)
cd playwright-runner && npm run dev

# Start local Supabase (requires Docker)
supabase start
```

### Build

```bash
npm run build
```

### Lint & Type Check

```bash
npm run lint
npm run typecheck
```

## Project Structure

### Frontend (`app/`)

The frontend is a React SPA built with Vite and Tailwind CSS. Key areas:

- **`components/doc-studio/`** — All UI components organized by feature (tabs, settings, review, timeline)
- **`hooks/`** — Custom hooks for state management (useDocStudio, useDocStudioRender, etc.)
- **`services/documentation/`** — Business logic for rendering, audio, captions, timeline, and export
- **`lib/remotion/`** — Remotion video composition planning and assembly
- **`lib/pdf/`** — PDF document generation with 19 templates
- **`lib/ffmpeg/`** — FFmpeg command building for video processing

### Playwright Runner (`playwright-runner/`)

A standalone Express service for browser automation:

- Captures screenshots and videos of web UIs
- Executes workflow steps defined in drafts
- Handles authentication and session management
- Uploads assets to Supabase Storage

### Edge Functions (`supabase/functions/`)

20 serverless functions handling:

- Content generation (AI-powered)
- Render job management
- Narration and caption processing
- Quality and integrity validation
- Review workflow orchestration
- Export and packaging

## CI Sync

This directory is automatically synced to [`kdeyarmin/DocStudio`](https://github.com/kdeyarmin/DocStudio) via the `sync-docstudio.yml` GitHub Actions workflow in the CMbackup repository. Any changes pushed to `main` that touch `DocStudio/` will trigger a force-push to the standalone repo.

## License

Proprietary. All rights reserved.
