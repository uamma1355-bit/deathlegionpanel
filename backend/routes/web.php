<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Auth;

/*
|--------------------------------------------------------------------------
| Web Routes (decoupled backend)
|--------------------------------------------------------------------------
|
| The React SPA lives in `frontend/` and is served completely separately
| from this backend. The bare-domain `GET /` route is registered in
| `routes/base.php` (named `index`, used by the admin Blade layout's
| "Exit Admin Control" link).
|
| We register the `auth.login` and `auth.logout` named routes here so
| that the upstream admin Blade layout (`resources/views/layouts/admin.blade.php`)
| — which we copy verbatim — keeps rendering. In the decoupled backend
| the React SPA owns the actual login UI, so `auth.login` redirects to
| the operator-configured frontend URL (env `FRONTEND_LOGIN_URL`,
| defaulting to `/admin`). `auth.logout` calls the upstream
| `Auth\LoginController::logout` which clears the session.
|
*/

// Named-route compatibility for the admin Blade layout.
Route::get('/login', function () {
    return redirect(env('FRONTEND_LOGIN_URL', '/admin'));
})->name('auth.login');

Route::post('/logout', [Auth\LoginController::class, 'logout'])
    ->middleware('auth')
    ->name('auth.logout');
