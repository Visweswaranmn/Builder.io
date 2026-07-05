import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';

/** Public splash/landing page. */
export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center text-center">
      <span className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
        <Building2 className="h-8 w-8" strokeWidth={2} />
      </span>

      <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">BUILDER.IO</h1>
      <p className="mt-3 text-base text-ink-muted sm:text-lg">
        Construction Project Management, end to end.
      </p>
      <p className="mt-2 max-w-md text-sm text-ink-faint">
        Projects, teams, materials, vendors, finance, and site reporting — all in one place.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link to="/login">
          <Button size="md" icon={<ArrowRight className="h-4 w-4" />}>
            Sign in
          </Button>
        </Link>
        <Link to="/register">
          <Button variant="secondary" size="md">
            Create account
          </Button>
        </Link>
      </div>
    </div>
  );
}
