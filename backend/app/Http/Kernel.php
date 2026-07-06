<?php

namespace Pterodactyl\Http;

use Illuminate\Auth\Middleware\Authorize;
use Illuminate\Http\Middleware\HandleCors;
use Pterodactyl\Http\Middleware\Authenticate;
use Illuminate\Http\Middleware\TrustProxies;
use Pterodactyl\Http\Middleware\TrimStrings;
use Illuminate\Session\Middleware\StartSession;
use Pterodactyl\Http\Middleware\EncryptCookies;
use Pterodactyl\Http\Middleware\AdminAuthenticate;
use Pterodactyl\Http\Middleware\Api\IsValidJson;
use Pterodactyl\Http\Middleware\VerifyCsrfToken;
use Pterodactyl\Http\Middleware\VerifyReCaptcha;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Pterodactyl\Http\Middleware\LanguageMiddleware;
use Illuminate\Foundation\Http\Kernel as HttpKernel;
use Illuminate\Foundation\Http\Middleware\ValidatePostSize;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Middleware\ValidateSignature;
use Illuminate\Auth\Middleware\RequirePassword;
use Pterodactyl\Http\Middleware\Activity\TrackAPIKey;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Pterodactyl\Http\Middleware\MaintenanceMiddleware;
use Pterodactyl\Http\Middleware\EnsureStatefulRequests;
use Pterodactyl\Http\Middleware\RedirectIfAuthenticated;
use Illuminate\Auth\Middleware\AuthenticateWithBasicAuth;
use Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Pterodactyl\Http\Middleware\Api\Daemon\DaemonAuthenticate;
use Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Pterodactyl\Http\Middleware\Api\Client\SubstituteClientBindings;
use Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance;
use Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;
use Pterodactyl\Http\Middleware\Api\Application\AuthenticateApplicationUser;

class Kernel extends HttpKernel
{
    /**
     * The application's global HTTP middleware stack.
     *
     * These middleware run during every request to the application.
     */
    protected $middleware = [
        TrustProxies::class,
        HandleCors::class,
        PreventRequestsDuringMaintenance::class,
        ValidatePostSize::class,
        TrimStrings::class,
        ConvertEmptyStringsToNull::class,
    ];

    /**
     * The application's route middleware groups.
     *
     * In the decoupled backend the `api` group is the bare Laravel default
     * (stateful SPA support + throttle + bindings + JSON validation) and
     * does NOT apply `auth:sanctum` globally. Authentication is applied
     * per-surface via the `client-api`, `application-api`, and `daemon`
     * groups below.
     */
    protected $middlewareGroups = [
        'web' => [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
            LanguageMiddleware::class,
        ],
        'api' => [
            EnsureStatefulRequests::class,
            SubstituteBindings::class,
            IsValidJson::class,
        ],
        'application-api' => [
            SubstituteBindings::class,
            AuthenticateApplicationUser::class,
        ],
        'client-api' => [
            SubstituteClientBindings::class,
            'auth:sanctum',
            TrackAPIKey::class,
            RequireTwoFactorAuthentication::class,
            AuthenticateIPAccess::class,
            RequireClientApiKey::class,
        ],
        'daemon' => [
            SubstituteBindings::class,
            DaemonAuthenticate::class,
        ],
    ];

    /**
     * The application's route middleware.
     *
     * These middleware may be assigned to groups or used individually.
     */
    protected $routeMiddleware = [
        'auth' => Authenticate::class,
        'auth.basic' => AuthenticateWithBasicAuth::class,
        'auth.session' => AuthenticateSession::class,
        'guest' => RedirectIfAuthenticated::class,
        'csrf' => VerifyCsrfToken::class,
        'throttle' => ThrottleRequests::class,
        'can' => Authorize::class,
        'bindings' => SubstituteBindings::class,
        'recaptcha' => VerifyReCaptcha::class,
        'node.maintenance' => MaintenanceMiddleware::class,
        'signed' => ValidateSignature::class,
        'password.confirm' => RequirePassword::class,
        'server' => AuthenticateServerAccess::class,
        'activity' => TrackAPIKey::class,
        'admin' => AdminAuthenticate::class,
        'daemon' => DaemonAuthenticate::class,
    ];
}
