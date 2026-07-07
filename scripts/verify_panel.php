<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo 'APP_NAME: ' . config('app.name') . "\n";
echo 'APP_URL: ' . config('app.url') . "\n";

use Pterodactyl\Models\Server;
echo "\nServers:\n";
foreach (Server::orderBy('id')->get() as $s) {
    echo "  #{$s->id}: {$s->name} | {$s->image}\n";
}
