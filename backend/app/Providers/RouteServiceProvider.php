<?php

namespace Pterodactyl\Providers;

use Illuminate\Http\Request;
use Pterodactyl\Models\ApiKey;
use Pterodactyl\Models\Database;
use Illuminate\Support\Facades\Route;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Pterodactyl\Http\Middleware\TrimStrings;
use Pterodactyl\Http\Middleware\AdminAuthenticate;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    protected const FILE_PATH_REGEX = '/^\/api\/client\/servers\/([a-z0-9-]{36})\/files(\/?$|\/(.)*$)/i';

    /**
     * Define your route model bindings, pattern filters, etc.
     */
    public function boot()
    {
        $this->configureRateLimiting();

        // Disable trimming string values when requesting file information — it isn't helpful
        // and messes up the ability to actually open a directory that ends with a space.
        TrimStrings::skipWhen(function (Request $request) {
            return preg_match(self::FILE_PATH_REGEX, $request->getPathInfo()) === 1;
        });

        $this->registerRouteBindings();

        $this->routes(function () {
            // Admin Blade area — mounted under /admin, kept verbatim from upstream.
            // `auth` runs before `AdminAuthenticate` so unauthenticated visitors
            // are redirected to the React SPA's login page (FRONTEND_LOGIN_URL)
            // rather than receiving a 403 from AdminAuthenticate.
            Route::middleware(['web', 'auth', 'auth.session', RequireTwoFactorAuthentication::class, AdminAuthenticate::class])
                ->prefix('/admin')
                ->group(base_path('routes/admin.php'));

            // Bare-domain surface: locale loader + status/ping probes. No auth.
            Route::middleware(['web'])
                ->group(base_path('routes/base.php'));

            // Minimal web routes (just a redirect for direct backend visits).
            Route::middleware(['web'])
                ->group(base_path('routes/web.php'));

            // Client API — Sanctum stateful, subuser-permission scoped.
            Route::middleware(['api', 'client-api', 'throttle:api.client'])
                ->prefix('/api/client')
                ->scopeBindings()
                ->group(base_path('routes/api-client.php'));

            // Application API — ptla_ token, AdminAcl bitmask scoped.
            Route::middleware(['api', 'application-api', 'throttle:api.application'])
                ->prefix('/api/application')
                ->scopeBindings()
                ->group(base_path('routes/api-application.php'));

            // Wings → Panel callbacks. DaemonAuthenticate splits the bearer token
            // on `.` and looks up the node by daemon_token_id.
            Route::middleware(['api', 'daemon', 'throttle:api.daemon'])
                ->prefix('/api/remote')
                ->scopeBindings()
                ->group(base_path('routes/api-remote.php'));
        });
    }

    /**
     * Register explicit route model bindings.
     *
     * Upstream relies on `SubstituteClientBindings` for the `{server}` and `{user}`
     * (subuser) bindings on the Client API, and uses Laravel's default ID binding
     * elsewhere. We restate the bindings here per docs/04 §1 so that future
     * controllers can rely on the documented contract:
     *
     *   {server}     — uuid (36 chars) or uuidShort (8 chars); also falls back to id
     *   {node}       — id (default)
     *   {egg}        — id (default)
     *   {backup}     — uuid
     *   {schedule}   — id (default)
     *   {database}   — HashID (handled by `Database::resolveRouteBinding`)
     *   {allocation} — id (default)
     *   {subuser}    — id (default; the Client API overrides this for `user` param)
     *   {api_key}    — identifier (string)
     */
    protected function registerRouteBindings(): void
    {
        // `Database` uses HashIDs, so the binding resolution must go through the
        // model's `resolveRouteBinding` rather than Laravel's default id lookup.
        Route::model('database', Database::class);

        // Bind `{api_key}` by the public `identifier` column when used. The
        // existing `/api/client/account/api-keys/{identifier}` route continues
        // to use a plain string param (preserved for upstream compatibility);
        // this binding only kicks in for routes that name the param `api_key`.
        Route::bind('api_key', function ($value) {
            return ApiKey::query()
                ->where('identifier', $value)
                ->firstOrFail();
        });

        // Bind `{backup}` by uuid (Backups use UUIDs, not auto-increment IDs).
        Route::bind('backup', function ($value) {
            return \Pterodactyl\Models\Backup::query()
                ->where('uuid', $value)
                ->firstOrFail();
        });
    }

    /**
     * Configure the rate limiters for the application.
     */
    protected function configureRateLimiting()
    {
        // Authentication rate limiting. For login and checkpoint endpoints we'll apply
        // a limit of 10 requests per minute, for the forgot password endpoint apply a
        // limit of two per minute for the requester so that there is less ability to
        // trigger email spam.
        RateLimiter::for('authentication', function (Request $request) {
            if ($request->route()?->named('auth.post.forgot-password')
                || $request->route()?->named('api:client.auth.password.forgot')
            ) {
                return Limit::perMinute(2)->by($request->ip());
            }

            return Limit::perMinute(10);
        });

        // Client API: 720 requests per minute per authenticated user (or IP fallback).
        // Tied to the specific request user to prevent IP-hopping evasion.
        RateLimiter::for('api.client', function (Request $request) {
            $key = optional($request->user())->uuid ?: $request->ip();

            return Limit::perMinutes(
                config('http.rate_limit.client_period'),
                config('http.rate_limit.client')
            )->by($key);
        });

        // Application API: 240 requests per minute per authenticated user (or IP fallback).
        RateLimiter::for('api.application', function (Request $request) {
            $key = optional($request->user())->uuid ?: $request->ip();

            return Limit::perMinutes(
                config('http.rate_limit.application_period'),
                config('http.rate_limit.application')
            )->by($key);
        });

        // Wings (daemon) callbacks: 240 requests per minute per IP. Wings callbacks
        // are not authenticated via Sanctum so we key on IP only.
        RateLimiter::for('api.daemon', function (Request $request) {
            return Limit::perMinutes(1, 240)->by($request->ip());
        });
    }
}
