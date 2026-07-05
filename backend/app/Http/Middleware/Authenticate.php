<?php

namespace Pterodactyl\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;

/**
 * Custom Authenticate middleware.
 *
 * Upstream Pterodactyl relies on the Blade `/auth/login` route for the
 * "redirect to login" target. In the decoupled backend that route is gone
 * (auth is React-only), so we override `redirectTo()` to point at the
 * operator-configured frontend login URL via the `FRONTEND_LOGIN_URL` env
 * variable. The default `/login` target is a GET route registered in
 * `routes/web.php` that itself redirects to `FRONTEND_LOGIN_URL` (or `/admin`
 * if unset), so unauthenticated browser visits land on the React SPA's
 * login page rather than 404'ing.
 *
 * For JSON requests (e.g. stateful /api/* calls without a session) we
 * return null, which causes Laravel to throw an AuthenticationException —
 * the upstream `Handler::unauthenticated()` then converts that into a
 * 401 JSON response.
 */
class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     *
     * @param \Illuminate\Http\Request $request
     */
    protected function redirectTo($request): ?string
    {
        if (!$request->expectsJson()) {
            return env('FRONTEND_LOGIN_URL', '/login');
        }

        return null;
    }
}
