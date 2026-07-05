import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '@/api/auth';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { AuthFormCard, FlashMessage } from '@/components/AuthFormCard';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthFormCard title="Reset Link Sent">
        <p className="text-sm text-neutral-600">
          If the email exists in our system, a password reset link has been sent.
        </p>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard title="Reset Password">
      {error && <FlashMessage type="error">{error}</FlashMessage>}
      <form onSubmit={onSubmit} className="space-y-6">
        <Input
          type="email"
          label="Email Address"
          name="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          light
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Reset Link'}
        </Button>
      </form>
    </AuthFormCard>
  );
}
