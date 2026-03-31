import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WorkflowRunner } from './runner/WorkflowRunner';
import { checkAuth, RUNNER_SECRET_MISCONFIGURED } from './auth';
import {
  assertAllowedNavigationUrl,
  buildAllowedNavigationOrigins,
} from './navigationUrl';
import { validateRunRequest } from './runRequestValidation';

dotenv.config();

const ALLOWED_NAV_ORIGINS = buildAllowedNavigationOrigins();

const app = express();
app.use(
  cors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const o = new URL(origin).origin;
        if (ALLOWED_NAV_ORIGINS.has(o)) {
          callback(null, true);
          return;
        }
      } catch {
        /* invalid Origin header */
      }
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: '10mb' }));

const RUNNER_SECRET = process.env.PLAYWRIGHT_RUNNER_SECRET?.trim() ?? '';
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const SUPABASE_ORIGIN = (() => {
  if (!SUPABASE_URL) return null;

  try {
    return new URL(SUPABASE_URL).origin;
  } catch {
    return null;
  }
})();

const activeRunners = new Map<string, WorkflowRunner>();

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authError = checkAuth(req.headers.authorization, RUNNER_SECRET);
  if (authError === RUNNER_SECRET_MISCONFIGURED) {
    res.status(503).json({ error: authError });
    return;
  }
  if (authError) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: Boolean(RUNNER_SECRET) && Boolean(SUPABASE_URL) && Boolean(SUPABASE_SERVICE_ROLE_KEY),
    active_jobs: activeRunners.size,
    configured: {
      runner_secret: Boolean(RUNNER_SECRET),
      supabase_url: Boolean(SUPABASE_URL),
      supabase_service_role_key: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    },
  });
});

app.post('/run', authMiddleware, (req: Request, res: Response): void => {
  const validation = validateRunRequest(req.body, SUPABASE_ORIGIN);

  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const body = validation.value;
  const startUrlRaw = (body.workflow as { start_url?: unknown }).start_url;
  if (typeof startUrlRaw === 'string' && /^https?:\/\//i.test(startUrlRaw.trim())) {
    try {
      assertAllowedNavigationUrl(startUrlRaw, ALLOWED_NAV_ORIGINS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid workflow.start_url';
      res.status(400).json({ error: msg });
      return;
    }
  }

  if (activeRunners.has(body.job_id)) {
    res.status(409).json({ error: 'A runner for this job is already active.' });
    return;
  }

  const runner = new WorkflowRunner(body);
  activeRunners.set(body.job_id, runner);

  res.json({ accepted: true, job_id: body.job_id });

  runner
    .run()
    .catch((err) => {
      console.error(`[server] Uncaught runner error for job ${body.job_id}:`, err);
    })
    .finally(() => {
      activeRunners.delete(body.job_id);
    });
});

app.post('/cancel', authMiddleware, (req: Request, res: Response): void => {
  const { job_id } = req.body as { job_id?: string };

  if (!job_id) {
    res.status(400).json({ error: 'Missing job_id' });
    return;
  }

  const runner = activeRunners.get(job_id);
  if (runner) {
    runner.cancel();
    res.json({ cancelled: true, job_id });
  } else {
    res.json({ cancelled: false, job_id, reason: 'Job not found in active runners.' });
  }
});

const PORT = parseInt(process.env.PORT ?? '3456', 10);
app.listen(PORT, () => {
  console.log(`Doc Studio Playwright Runner listening on port ${PORT}`);
  if (!RUNNER_SECRET) {
    console.error('[server] PLAYWRIGHT_RUNNER_SECRET is not set — authenticated endpoints are disabled');
  }
  if (!SUPABASE_URL) {
    console.warn('[server] SUPABASE_URL is not set — asset uploads and callback validation will fail');
  } else if (!SUPABASE_ORIGIN) {
    console.warn('[server] SUPABASE_URL is invalid — asset uploads and callback validation will fail');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[server] SUPABASE_SERVICE_ROLE_KEY is not set — asset uploads and DB writes will fail');
  }
});
