import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { AuthFormCard, FlashMessage } from '@/components/AuthFormCard';

export function LoginCheckpointPage(): JSX.Element {
  const { loginCheckpoint } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const confirmationToken = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!confirmationToken) {
      navigate('/auth/login', { replace: true });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await loginCheckpoint({
        confirmation_token: confirmationToken,
        code: recoveryCode ? '' : code,
        recovery_token: recoveryCode || undefined,
      });
      navigate('/', { replace: true });
    } catch {
      setError('Invalid authentication code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFormCard title="Two-Factor Authentication">
      {error && <FlashMessage type="error">{error}</FlashMessage>}
      <p className="mb-6 text-sm text-neutral-600">{email}</p>
      <form onSubmit={onSubmit} className="space-y-6">
        <Input
          type="text"
          label="Authentication Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={!!recoveryCode || submitting}
          light
        />
        <Input
          type="text"
          label="Or use a recovery code"
          name="recovery"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
          disabled={!!code || submitting}
          light
        />
        <Button type="submit" className="w-full" disabled={submitting || (!code && !recoveryCode)}>
          {submitting ? 'Verifying…' : 'Verify'}
        </Button>
      </form>
    </AuthFormCard>
  );
}
