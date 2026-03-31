import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryProvider } from './lib/react-query';
import { ToastProvider } from './lib/toast';

const rootElement = document.getElementById('root') as HTMLElement;

if (!rootElement) {
  throw new Error('Root element #root not found. The application cannot initialize.');
}

(window as unknown as Record<string, unknown>).__docStudioMounted = true;

function showFatalError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  rootElement.textContent = '';
  const outer = document.createElement('div');
  outer.setAttribute('style', 'display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1e293b;color:#f1f5f9;font-family:system-ui;padding:2rem');
  const inner = document.createElement('div');
  inner.setAttribute('style', 'max-width:480px;text-align:center');
  const heading = document.createElement('h2');
  heading.setAttribute('style', 'font-size:1.25rem;margin-bottom:1rem');
  heading.textContent = 'Application Error';
  const para = document.createElement('p');
  para.setAttribute('style', 'color:#94a3b8;line-height:1.6;margin-bottom:1.5rem');
  para.textContent = msg;
  const btn = document.createElement('button');
  btn.setAttribute('style', 'padding:0.625rem 1.5rem;background:#3b82f6;color:#fff;border:none;border-radius:0.5rem;cursor:pointer;font-size:0.875rem;font-weight:500');
  btn.textContent = 'Reload Page';
  btn.addEventListener('click', () => window.location.reload());
  inner.appendChild(heading);
  inner.appendChild(para);
  inner.appendChild(btn);
  outer.appendChild(inner);
  rootElement.appendChild(outer);
}

try {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryProvider>
    </StrictMode>
  );
} catch (error) {
  showFatalError(error);
}
