import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { performPasswordReset } from '@/api/auth';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { AuthFormCard, FlashMessage } from '@/components/AuthFormCard';

export function ResetPasswordPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await performPasswordReset({ email, password, password_confirmation: confirm, token });
      navigate('/auth/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFormCard title="Set New Password">
      {error && <FlashMessage type="error">{error}</FlashMessage>}
      <form onSubmit={onSubmit} className="space-y-6">
        <Input
          type="email"
          label="Email Address"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          light
        />
        <Input
          type="password"
          label="New Password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          light
        />
        <Input
          type="password"
          label="Confirm Password"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={submitting}
          light
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Resetting…' : 'Reset Password'}
        </Button>
      </form>
    </AuthFormCard>
  );
}
