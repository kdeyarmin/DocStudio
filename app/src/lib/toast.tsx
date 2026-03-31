import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { createStableId } from './browser';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts((prev) => {
      const isDuplicate = prev.some(
        (t) => t.title === toast.title && t.type === toast.type && t.message === toast.message
      );
      if (isDuplicate) return prev;
      const id = createStableId('toast');
      return [...prev, { ...toast, id }];
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  const contextShowToast = context.showToast;

  const showToast = useCallback((titleOrToast: string | Omit<Toast, 'id'>, type?: ToastType) => {
    if (typeof titleOrToast === 'string') {
      contextShowToast({
        title: titleOrToast,
        type: type || 'info',
      });
    } else {
      contextShowToast(titleOrToast);
    }
  }, [contextShowToast]);

  return {
    ...context,
    showToast,
  };
}

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      aria-live="polite"
      aria-atomic="false"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const duration = toast.duration || 5000;
  const [progress, setProgress] = useState(1);
  const remainingRef = useRef(duration);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>();
  const pausedRef = useRef(false);
  const updateProgressRef = useRef<() => void>(() => {});

  const updateProgress = useCallback(() => {
    if (pausedRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(0, remainingRef.current - elapsed);
    setProgress(remaining / duration);
    if (remaining > 0) {
      rafRef.current = requestAnimationFrame(updateProgressRef.current);
    }
  }, [duration]);

  useEffect(() => {
    updateProgressRef.current = updateProgress;
  }, [updateProgress]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onClose(toast.id);
    }, remainingRef.current);
    rafRef.current = requestAnimationFrame(updateProgress);
  }, [onClose, toast.id, updateProgress]);

  const pauseTimer = useCallback(() => {
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const resumeTimer = useCallback(() => {
    pausedRef.current = false;
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startTimer]);

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  };

  const iconColors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const progressColors = {
    success: 'bg-green-400',
    error: 'bg-red-400',
    warning: 'bg-yellow-400',
    info: 'bg-blue-400',
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`${colors[toast.type]} border rounded-lg shadow-lg overflow-hidden flex flex-col animate-slide-in-right`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={resumeTimer}
    >
      <div className="p-4 flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColors[toast.type]} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="flex-shrink-0 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>
      </div>
      <div className="h-0.5 bg-slate-200/60 dark:bg-slate-700/60">
        <div
          className={`h-full ${progressColors[toast.type]} origin-left`}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
