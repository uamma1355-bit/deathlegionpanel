<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Auth;
use Pterodactyl\Http\Controllers\Api\Client;
use Pterodactyl\Http\Middleware\Activity\ServerSubject;
use Pterodactyl\Http\Middleware\Activity\AccountSubject;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Pterodactyl\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client
|
| This file is the contract between the decoupled `frontend/` (React) and the
| `backend/` Laravel API. It mirrors the upstream Pterodactyl Client API
| surface (see docs/06-APIContract.md §3-13) and adds a `/auth` sub-prefix
| that exposes the login/checkpoint/logout/password-reset flows previously
| served under `/auth/*` by the upstream Blade/React templates.
|
*/

// Root: list of permissions the current user/API key is allowed to use.
Route::get('/', [Client\ClientController::class, 'index'])->name('api:client.index');
Route::get('/permissions', [Client\ClientController::class, 'permissions']);

/*
|--------------------------------------------------------------------------
| Auth endpoints (docs/06 §3)
|--------------------------------------------------------------------------
|
| These routes are mounted under the `client-api` + `api` middleware groups
| via the RouteServiceProvider, but they need to be reachable by unauthenticated
| callers, so we strip `auth:sanctum`, `RequireTwoFactorAuthentication`, and
| `RequireClientApiKey` here. The `guest` middleware is added so that an
| already-authenticated session is rejected from the login endpoint.
|
| Note: upstream's `Auth\LoginController::login` returns the legacy
| `{ data: { complete, confirmation_token } }` shape (HTTP 200) rather than
| the JSON:API error envelope described in docs/06 §3. This is a deliberate
| deviation in service of "trim, don't rewrite" — see worklog Task 7.
|
*/
Route::prefix('/auth')->group(function () {
    Route::post('/login', [Auth\LoginController::class, 'login'])
        ->middleware(['recaptcha', 'throttle:authentication'])
        ->withoutMiddleware(['auth:sanctum', RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey::class, \Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess::class, \Pterodactyl\Http\Middleware\Activity\TrackAPIKey::class])
        ->name('api:client.auth.login');

    Route::post('/login-checkpoint', Auth\LoginCheckpointController::class)
        ->middleware(['throttle:authentication'])
        ->withoutMiddleware(['auth:sanctum', RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey::class, \Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess::class, \Pterodactyl\Http\Middleware\Activity\TrackAPIKey::class])
        ->name('api:client.auth.login-checkpoint');

    Route::post('/logout', [Auth\LoginController::class, 'logout'])
        ->withoutMiddleware([RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey::class, \Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess::class])
        ->name('api:client.auth.logout');

    Route::post('/password', [Auth\ForgotPasswordController::class, 'sendResetLinkEmail'])
        ->middleware(['recaptcha', 'throttle:authentication'])
        ->withoutMiddleware(['auth:sanctum', RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey::class, \Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess::class, \Pterodactyl\Http\Middleware\Activity\TrackAPIKey::class])
        ->name('api:client.auth.password.forgot');

    Route::post('/password/reset', Auth\ResetPasswordController::class)
        ->withoutMiddleware(['auth:sanctum', RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\Api\Client\RequireClientApiKey::class, \Pterodactyl\Http\Middleware\Api\AuthenticateIPAccess::class, \Pterodactyl\Http\Middleware\Activity\TrackAPIKey::class])
        ->name('api:client.auth.password.reset');
});

/*
|--------------------------------------------------------------------------
| Account endpoints (docs/06 §4)
|--------------------------------------------------------------------------
*/
Route::prefix('/account')->middleware(AccountSubject::class)->group(function () {
    Route::prefix('/')->withoutMiddleware(RequireTwoFactorAuthentication::class)->group(function () {
        Route::get('/', [Client\AccountController::class, 'index'])->name('api:client.account');
        Route::get('/two-factor', [Client\TwoFactorController::class, 'index']);
        Route::post('/two-factor', [Client\TwoFactorController::class, 'store']);
        Route::delete('/two-factor', [Client\TwoFactorController::class, 'delete']);
    });

    Route::put('/email', [Client\AccountController::class, 'updateEmail'])->name('api:client.account.update-email');
    Route::put('/password', [Client\AccountController::class, 'updatePassword'])->name('api:client.account.update-password');

    Route::get('/activity', Client\ActivityLogController::class)->name('api:client.account.activity');

    Route::get('/api-keys', [Client\ApiKeyController::class, 'index']);
    Route::post('/api-keys', [Client\ApiKeyController::class, 'store']);
    Route::delete('/api-keys/{identifier}', [Client\ApiKeyController::class, 'delete']);

    Route::prefix('/ssh-keys')->group(function () {
        Route::get('/', [Client\SSHKeyController::class, 'index']);
        Route::post('/', [Client\SSHKeyController::class, 'store']);
        Route::post('/remove', [Client\SSHKeyController::class, 'delete']);
    });
});

/*
|--------------------------------------------------------------------------
| Server-scoped endpoints (docs/06 §5-13)
|--------------------------------------------------------------------------
|
| Endpoint: /api/client/servers/{server}
|
| The `{server}` route binding is configured in SubstituteClientBindings and
| accepts either a full UUID (36 chars) or the short UUID (8 chars).
|
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], function () {
    Route::get('/', [Client\Servers\ServerController::class, 'index'])->name('api:client:server.view');
    Route::get('/websocket', Client\Servers\WebsocketController::class)->name('api:client:server.ws');
    Route::get('/resources', Client\Servers\ResourceUtilizationController::class)->name('api:client:server.resources');
    Route::get('/activity', Client\Servers\ActivityLogController::class)->name('api:client:server.activity');

    Route::post('/command', [Client\Servers\CommandController::class, 'index']);
    Route::post('/power', [Client\Servers\PowerController::class, 'index']);

    Route::group(['prefix' => '/databases'], function () {
        Route::get('/', [Client\Servers\DatabaseController::class, 'index']);
        Route::post('/', [Client\Servers\DatabaseController::class, 'store']);
        Route::post('/{database}/rotate-password', [Client\Servers\DatabaseController::class, 'rotatePassword']);
        Route::delete('/{database}', [Client\Servers\DatabaseController::class, 'delete']);
    });

    Route::group(['prefix' => '/files'], function () {
        Route::get('/list', [Client\Servers\FileController::class, 'directory']);
        Route::get('/contents', [Client\Servers\FileController::class, 'contents']);
        Route::get('/download', [Client\Servers\FileController::class, 'download']);
        Route::put('/rename', [Client\Servers\FileController::class, 'rename']);
        Route::post('/copy', [Client\Servers\FileController::class, 'copy']);
        Route::post('/write', [Client\Servers\FileController::class, 'write']);
        Route::put('/write', [Client\Servers\FileController::class, 'write']);
        Route::post('/compress', [Client\Servers\FileController::class, 'compress']);
        Route::post('/decompress', [Client\Servers\FileController::class, 'decompress']);
        Route::post('/delete', [Client\Servers\FileController::class, 'delete']);
        Route::post('/create-folder', [Client\Servers\FileController::class, 'create']);
        Route::post('/chmod', [Client\Servers\FileController::class, 'chmod']);
        Route::post('/pull', [Client\Servers\FileController::class, 'pull'])->middleware(['throttle:10,5']);
        Route::get('/upload', Client\Servers\FileUploadController::class);
    });

    Route::group(['prefix' => '/schedules'], function () {
        Route::get('/', [Client\Servers\ScheduleController::class, 'index']);
        Route::post('/', [Client\Servers\ScheduleController::class, 'store']);
        Route::get('/{schedule}', [Client\Servers\ScheduleController::class, 'view']);
        Route::post('/{schedule}', [Client\Servers\ScheduleController::class, 'update']);
        Route::post('/{schedule}/execute', [Client\Servers\ScheduleController::class, 'execute']);
        Route::delete('/{schedule}', [Client\Servers\ScheduleController::class, 'delete']);

        Route::post('/{schedule}/tasks', [Client\Servers\ScheduleTaskController::class, 'store']);
        Route::post('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'update']);
        Route::delete('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'delete']);
    });

    Route::group(['prefix' => '/network'], function () {
        Route::get('/allocations', [Client\Servers\NetworkAllocationController::class, 'index']);
        Route::post('/allocations', [Client\Servers\NetworkAllocationController::class, 'store']);
        Route::post('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'update']);
        Route::post('/allocations/{allocation}/primary', [Client\Servers\NetworkAllocationController::class, 'setPrimary']);
        Route::delete('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'delete']);
    });

    Route::group(['prefix' => '/users'], function () {
        Route::get('/', [Client\Servers\SubuserController::class, 'index']);
        Route::post('/', [Client\Servers\SubuserController::class, 'store']);
        Route::get('/{user}', [Client\Servers\SubuserController::class, 'view']);
        Route::post('/{user}', [Client\Servers\SubuserController::class, 'update']);
        Route::delete('/{user}', [Client\Servers\SubuserController::class, 'delete']);
    });

    Route::group(['prefix' => '/backups'], function () {
        Route::get('/', [Client\Servers\BackupController::class, 'index']);
        Route::post('/', [Client\Servers\BackupController::class, 'store']);
        Route::get('/{backup}', [Client\Servers\BackupController::class, 'view']);
        Route::get('/{backup}/download', [Client\Servers\BackupController::class, 'download']);
        Route::post('/{backup}/lock', [Client\Servers\BackupController::class, 'toggleLock']);
        Route::post('/{backup}/restore', [Client\Servers\BackupController::class, 'restore']);
        Route::delete('/{backup}', [Client\Servers\BackupController::class, 'delete']);
    });

    Route::group(['prefix' => '/startup'], function () {
        Route::get('/', [Client\Servers\StartupController::class, 'index']);
        Route::put('/variable', [Client\Servers\StartupController::class, 'update']);
        // Note: upstream exposes the docker-image mutation under /settings/docker-image
        // (see §5 of docs/06). docs/06 §11 also mentions /startup/image as a future
        // alias; we don't add it here because StartupController has no `dockerImage`
        // method upstream. Add it only when a future controller method exists.
    });

    Route::group(['prefix' => '/settings'], function () {
        Route::post('/rename', [Client\Servers\SettingsController::class, 'rename']);
        Route::post('/reinstall', [Client\Servers\SettingsController::class, 'reinstall']);
        Route::put('/docker-image', [Client\Servers\SettingsController::class, 'dockerImage']);
    });
});
