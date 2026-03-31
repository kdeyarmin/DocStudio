import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { errorTracker } from './error-tracker';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof Error && error.message.includes('PGRST')) return false;
        return true;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always' as const,
      networkMode: 'online' as const,
    },
    mutations: {
      onError: (error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        errorTracker.captureError({
          error_message: err.message,
          error_stack: err.stack,
          error_type: 'runtime',
          severity: 'error',
          current_route: window.location.pathname,
          user_action_context: 'react-query-mutation',
        });
      },
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
