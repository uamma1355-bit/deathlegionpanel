import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { AuthFormCard, FlashMessage } from '@/components/AuthFormCard';

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ user, password });
      const redirect = params.get('redirect');
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      if ((err as { type?: string }).type === 'two-factor-required') {
        const token = (err as { confirmationToken: string }).confirmationToken;
        const userEncoded = encodeURIComponent(user);
        navigate(`/auth/login/checkpoint?token=${encodeURIComponent(token)}&email=${userEncoded}`);
        return;
      }
      setError(t('auth.login.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFormCard title="Login to Continue">
      {error && <FlashMessage type="error">{error}</FlashMessage>}
      <form onSubmit={onSubmit} className="space-y-6">
        <Input
          type="text"
          label="Username or Email"
          name="user"
          autoComplete="username"
          autoFocus
          required
          value={user}
          onChange={(e) => setUser(e.target.value)}
          disabled={submitting}
          light
        />
        <Input
          type="password"
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          light
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Login'}
        </Button>
        <div className="text-center">
          <Link to="/auth/password" className="text-sm text-blue-500 hover:text-blue-400 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthFormCard>
  );
}
