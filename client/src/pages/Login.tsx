import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Building2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TextField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const DEMO_EMAIL = 'admin@gmail.com';
const DEMO_PASSWORD = '12345678';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError('');
    try {
      await login(loginEmail, loginPassword);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await doLogin(email, password);
    setSubmitting(false);
  }

  async function handleDemoLogin() {
    setDemoSubmitting(true);
    await doLogin(DEMO_EMAIL, DEMO_PASSWORD);
    setDemoSubmitting(false);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <Building2 className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h1 className="text-2xl font-bold text-ink">Sign in to BUILDER.IO</h1>
        <p className="mt-1 text-sm text-ink-muted">Access your construction management dashboard.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-panel p-6 shadow-md">
        <TextField
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div>
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <div className="mt-1.5 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" loading={submitting} disabled={demoSubmitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-ink-faint">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          type="button"
          variant="secondary"
          loading={demoSubmitting}
          disabled={submitting}
          onClick={handleDemoLogin}
          icon={<Sparkles className="h-4 w-4" />}
          className="w-full"
        >
          {demoSubmitting ? 'Signing in…' : 'Demo Login (for Recruiters)'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        No account?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Register
        </Link>
      </p>
    </div>
  );
}
