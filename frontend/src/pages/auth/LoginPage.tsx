/**
 * Login page — verbatim Pterodactyl style.
 * White card with Pterodactyl logo on left, form on right.
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { PterodactylLogo } from '@/components/PterodactylLogo';

export function LoginPage(): JSX.Element {
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
        navigate(`/auth/login/checkpoint?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user)}`);
        return;
      }
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="py-4 text-center text-3xl font-medium text-neutral-100">Login to Continue</h2>
      {error && (
        <div className="mx-1 mb-2 rounded border border-red-700 bg-red-900/50 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="mx-1 flex w-full flex-col rounded-lg bg-white p-6 shadow-lg md:flex-row md:pl-0">
        <div className="mb-6 flex-none select-none self-center md:mb-0">
          <PterodactylLogo className="mx-auto block w-48 md:w-64" />
        </div>
        <div className="flex-1">
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
        </div>
      </div>
    </div>
  );
}

function extractError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'errors' in err) {
    const errors = (err as { errors: { detail?: string; code?: string }[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0]?.detail ?? errors[0]?.code ?? 'Invalid credentials.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Invalid credentials.';
}
