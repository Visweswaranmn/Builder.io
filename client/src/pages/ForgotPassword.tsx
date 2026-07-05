import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MailCheck } from 'lucide-react';
import { api } from '@/lib/axios';
import { TextField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post<{ data?: { resetToken?: string } }>('/auth/forgot-password', { email });
      setDevResetToken(res.data.data?.resetToken ?? null);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <Building2 className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h1 className="text-2xl font-bold text-ink">Forgot your password?</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-panel p-6 shadow-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <MailCheck className="h-8 w-8 text-brand-600" strokeWidth={1.5} />
            <p className="text-sm text-ink">
              If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent.
            </p>
            {devResetToken && (
              <div className="w-full rounded-lg bg-slate-100 p-3 text-left text-xs">
                <p className="mb-1 font-medium text-ink-muted">Dev mode — no email delivery configured:</p>
                <Link
                  to={`/reset-password?token=${devResetToken}`}
                  className="break-all font-mono text-brand-700 hover:underline"
                >
                  /reset-password?token={devResetToken}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
