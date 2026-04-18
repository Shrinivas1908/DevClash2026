import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from '@/pages/LandingPage';
import { GraphPage } from '@/pages/GraphPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToastContainer } from '@/components/ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/graph/:jobId" element={<GraphPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastContainer />
      </HashRouter>
    </QueryClientProvider>
  );
}
