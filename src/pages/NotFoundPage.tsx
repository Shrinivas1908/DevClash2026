import { Link } from 'react-router-dom';
import { Home, Network } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-border flex items-center justify-center mx-auto mb-6">
          <Network className="w-8 h-8 text-text-muted" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
        <p className="text-text-muted mb-8">This graph node doesn&apos;t exist.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-accent-blue text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
