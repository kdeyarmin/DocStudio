export const colors = {
  brand: {
    50: '#eef5ff',
    100: '#d9e8ff',
    200: '#bbd5ff',
    300: '#8cbbff',
    400: '#5596ff',
    500: '#3391ff',
    600: '#1a6ffa',
    700: '#0d55e0',
    800: '#1245b5',
    900: '#153d8e',
    950: '#112756',
  },
  steel: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  black: '#000000',
} as const;

export const fonts = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, Fira Code, monospace',
} as const;

export const shadows = {
  card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  elevated: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
  modal: '0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.06)',
  glowBrand: '0 0 20px rgba(26,111,250,0.15)',
} as const;
