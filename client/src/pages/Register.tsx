import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { TextField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const DEMO_EMAIL = 'admin@gmail.com';
const DEMO_PASSWORD = '12345678';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/register', { name, email, password });
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError('');
    setDemoSubmitting(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setDemoSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <Building2 className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h1 className="text-2xl font-bold text-ink">Create an account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          New accounts start with the Site Engineer role. An admin can promote you later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-panel p-6 shadow-md">
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" loading={submitting} disabled={demoSubmitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
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
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
