<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Http\Controllers\Base\LocaleController;

/*
|--------------------------------------------------------------------------
| Base Routes (decoupled backend)
|--------------------------------------------------------------------------
|
| In the decoupled backend the React SPA lives in `frontend/` and calls into
| the API under `/api/client`. The only web-surface routes that remain are
| the locale loader (used by the SPA's i18n bootstrap) and two trivial
| health-check endpoints.
|
*/

Route::get('/locale.js', [LocaleController::class, 'index'])
    ->withoutMiddleware(['auth', \Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class])
    ->name('locale');

// `index` is referenced by resources/views/layouts/admin.blade.php as the
// "Exit Admin Control" link. In the decoupled backend the React SPA owns
// the server-listing UI, so we redirect to the operator-configured
// frontend URL (or fall back to /admin).
Route::get('/', function () {
    return redirect(env('FRONTEND_URL', '/admin'));
})
    ->withoutMiddleware(['auth', \Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class])
    ->name('index');

Route::get('/status', function () {
    $database = true;
    try {
        DB::connection()->getPdo();
    } catch (\Throwable $e) {
        $database = false;
    }

    return response()->json([
        'status' => $database ? 'ok' : 'degraded',
        'database' => $database,
        'version' => config('app.version', 'canary'),
    ]);
})->withoutMiddleware(['auth', \Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class])
  ->name('status');

Route::get('/ping', fn () => response()->noContent())
    ->withoutMiddleware(['auth', \Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class])
    ->name('ping');
