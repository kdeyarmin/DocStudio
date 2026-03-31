import { supabase } from './supabase';
import { logger } from './logger';

interface Breadcrumb {
  timestamp: number;
  action: string;
  detail?: string;
  route?: string;
}

interface ErrorPayload {
  error_message: string;
  error_stack?: string;
  error_type: 'runtime' | 'unhandled_rejection' | 'react_boundary' | 'network' | 'console_error';
  severity: 'critical' | 'error' | 'warning';
  component_name?: string;
  current_route?: string;
  user_action_context?: string;
  browser_info?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 15;
const DEDUP_WINDOW_MS = 5000;
const RATE_LIMIT_WINDOW_MS = 60_000;

class ErrorTracker {
  private breadcrumbs: Breadcrumb[] = [];
  private recentErrors = new Map<string, number>();
  private dbInsertTimestamps = new Map<string, number>();
  private userId: string | null = null;
  private organizationId: string | null = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('error', (event) => {
      const errorEvent = event as ErrorEvent;
      const msg = errorEvent.message || errorEvent.error?.message || 'Unknown error';
      if (this.shouldIgnore(msg)) return;
      this.captureError({
        error_message: msg,
        error_stack: errorEvent.error?.stack || `${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno}`,
        error_type: 'runtime',
        severity: 'error',
        current_route: window.location.pathname,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      if (this.shouldIgnore(msg)) return;
      this.captureError({
        error_message: msg,
        error_stack: reason instanceof Error ? reason.stack : undefined,
        error_type: 'unhandled_rejection',
        severity: 'error',
        current_route: window.location.pathname,
      });
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button, a, [role="button"]');
      if (btn) {
        const label = btn.textContent?.trim().slice(0, 80) ||
          btn.getAttribute('aria-label') ||
          btn.tagName;
        this.addBreadcrumb('click', label);
      }
    }, { capture: true, passive: true });

    const origPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      origPushState(...args);
      this.addBreadcrumb('navigation', window.location.pathname);
    };

    window.addEventListener('popstate', () => {
      this.addBreadcrumb('navigation', window.location.pathname);
    });
  }

  setUser(userId: string | null, organizationId: string | null) {
    this.userId = userId;
    this.organizationId = organizationId;
  }

  addBreadcrumb(action: string, detail?: string) {
    this.breadcrumbs.push({
      timestamp: Date.now(),
      action,
      detail,
      route: window.location.pathname,
    });
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
  }

  trackAction(description: string) {
    this.addBreadcrumb('user_action', description);
  }

  private shouldIgnore(msg: string): boolean {
    const ignorePatterns = [
      'ResizeObserver loop',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ];
    return ignorePatterns.some(p => msg.includes(p));
  }

  private isDuplicate(msg: string, component?: string): boolean {
    const key = `${msg}::${component || ''}`;
    const lastSeen = this.recentErrors.get(key);
    const now = Date.now();
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return true;
    this.recentErrors.set(key, now);
    if (this.recentErrors.size > 100) {
      const entries = Array.from(this.recentErrors.entries());
      entries.slice(0, 50).forEach(([k]) => this.recentErrors.delete(k));
    }
    return false;
  }

  private buildActionContext(): string {
    if (this.breadcrumbs.length === 0) return 'No recent user actions recorded';
    const recent = this.breadcrumbs.slice(-5);
    return recent.map(b => {
      const time = new Date(b.timestamp).toLocaleTimeString();
      if (b.action === 'click') return `[${time}] Clicked: "${b.detail}"`;
      if (b.action === 'navigation') return `[${time}] Navigated to: ${b.detail}`;
      if (b.action === 'form_submit') return `[${time}] Submitted form: ${b.detail}`;
      return `[${time}] ${b.action}: ${b.detail || ''}`;
    }).join('\n');
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return window.location.pathname;
    }
  }

  private getBrowserInfo(): Record<string, unknown> {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      url: this.sanitizeUrl(window.location.href),
      timestamp: new Date().toISOString(),
    };
  }

  private isRateLimited(msg: string, component?: string): boolean {
    const key = `rl::${msg}::${component || ''}`;
    const last = this.dbInsertTimestamps.get(key);
    const now = Date.now();
    if (last && now - last < RATE_LIMIT_WINDOW_MS) return true;
    this.dbInsertTimestamps.set(key, now);
    if (this.dbInsertTimestamps.size > 200) {
      const entries = Array.from(this.dbInsertTimestamps.entries());
      entries.slice(0, 100).forEach(([k]) => this.dbInsertTimestamps.delete(k));
    }
    return false;
  }

  async captureError(payload: ErrorPayload) {
    if (this.isDuplicate(payload.error_message, payload.component_name)) return;
    if (this.isRateLimited(payload.error_message, payload.component_name)) return;

    const record = {
      user_id: this.userId,
      organization_id: this.organizationId,
      error_message: payload.error_message.slice(0, 2000),
      error_stack: payload.error_stack?.slice(0, 5000) || null,
      error_type: payload.error_type,
      severity: payload.severity,
      component_name: payload.component_name || null,
      current_route: payload.current_route || window.location.pathname,
      user_action_context: payload.user_action_context || this.buildActionContext(),
      browser_info: payload.browser_info || this.getBrowserInfo(),
      resolved_status: 'new',
    };

    try {
      const { data, error } = await supabase
        .from('client_error_logs')
        .insert(record)
        .select('id')
        .maybeSingle();

      if (!error && data?.id) {
        this.triggerAutoFix(data.id, payload.error_message, payload.error_type);
      }
    } catch {
      // Silently fail - don't create error loops
    }
  }

  captureReactBoundaryError(error: Error, componentStack?: string) {
    this.captureError({
      error_message: error.message,
      error_stack: error.stack
        ? `${error.stack}\n\nComponent Stack: ${componentStack || ''}`
        : componentStack || undefined,
      error_type: 'react_boundary',
      severity: 'critical',
      current_route: window.location.pathname,
    });
  }

  private async triggerAutoFix(errorLogId: string, errorMessage: string, errorType: string) {
    try {
      const { data: rules } = await supabase
        .from('error_pattern_rules')
        .select('*')
        .eq('auto_fix_enabled', true)
        .order('priority', { ascending: false });

      if (!rules || rules.length === 0) return;

      const matchedRule = rules.find(rule => {
        const patternMatch = errorMessage.toLowerCase().includes(rule.error_pattern.toLowerCase());
        const typeMatch = !rule.error_type || rule.error_type === errorType;
        return patternMatch && typeMatch;
      });

      if (!matchedRule) return;

      const instructions = matchedRule.fix_instructions as Record<string, unknown>;
      const action = instructions.action as string;
      const message = instructions.message as string | null;

      const { error: fixErr } = await supabase.from('auto_fix_attempts').insert({
        error_log_id: errorLogId,
        fix_strategy: matchedRule.fix_strategy,
        fix_description: `Pattern matched: "${matchedRule.error_pattern}" -> ${action}`,
        fix_result: 'pending',
      });
      if (fixErr) logger.warn('Failed to log auto-fix attempt:', fixErr);

      const ALLOWED_ACTIONS = new Set(['refresh_auth_token', 'retry_with_backoff', 'suppress', 'create_ticket']);
      let success = false;

      if (!ALLOWED_ACTIONS.has(action)) {
        success = false;
      } else {
        switch (action) {
          case 'refresh_auth_token':
            try {
              const { error } = await supabase.auth.refreshSession();
              success = !error;
              if (message && success) this.showFixNotification(message);
            } catch { success = false; }
            break;

          case 'retry_with_backoff':
            if (message) this.showFixNotification(message);
            success = true;
            break;

          case 'suppress':
            success = true;
            break;

          case 'create_ticket':
            success = false;
            break;

          default:
            success = false;
        }
      }

      const result = success ? 'success' : 'failed';

      await supabase
        .from('auto_fix_attempts')
        .update({ fix_result: result })
        .eq('error_log_id', errorLogId);

      await supabase
        .from('client_error_logs')
        .update({
          resolved_status: success ? 'auto_fixed' : 'escalated',
        })
        .eq('id', errorLogId);

      const counterField = success ? 'success_count' : 'failure_count';
      const currentVal = success ? matchedRule.success_count : matchedRule.failure_count;
      await supabase
        .from('error_pattern_rules')
        .update({ [counterField]: currentVal + 1 })
        .eq('id', matchedRule.id)
        .eq(counterField, currentVal);
    } catch {
      // Silently fail
    }
  }

  private showFixNotification(message: string) {
    const el = document.createElement('div');
    el.className = 'fixed bottom-24 right-6 z-[9999] animate-in slide-in-from-right';
    const container = document.createElement('div');
    container.className = 'bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'w-5 h-5 flex-shrink-0');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('viewBox', '0 0 24 24');

    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('stroke-linecap', 'round');
    iconPath.setAttribute('stroke-linejoin', 'round');
    iconPath.setAttribute('stroke-width', '2');
    iconPath.setAttribute('d', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z');
    icon.appendChild(iconPath);

    const text = document.createElement('span');
    text.className = 'text-sm font-medium flex-1';
    text.textContent = message;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dismiss = 'true';
    button.setAttribute('aria-label', 'Dismiss');
    button.className = 'ml-1 p-0.5 rounded hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-white/50 flex-shrink-0';
    button.style.lineHeight = '1';

    const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeIcon.setAttribute('class', 'w-4 h-4');
    closeIcon.setAttribute('fill', 'none');
    closeIcon.setAttribute('stroke', 'currentColor');
    closeIcon.setAttribute('viewBox', '0 0 24 24');

    const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('stroke-linecap', 'round');
    closePath.setAttribute('stroke-linejoin', 'round');
    closePath.setAttribute('stroke-width', '2');
    closePath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
    closeIcon.appendChild(closePath);
    button.appendChild(closeIcon);

    container.append(icon, text, button);
    el.appendChild(container);

    const dismiss = () => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    };

    button.addEventListener('click', dismiss);

    document.body.appendChild(el);
    const autoHide = setTimeout(dismiss, 4000);

    button.addEventListener('click', () => clearTimeout(autoHide), { once: true });
  }
}

export const errorTracker = new ErrorTracker();
