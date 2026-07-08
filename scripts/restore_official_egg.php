<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggVariable;
use Pterodactyl\Models\Server;

// EXACT official egg from eggs.pterodactyl.io - NO modifications
$egg = Egg::find(1);

// Read the official egg JSON
$official = json_decode(file_get_contents('/tmp/official-egg.json'), true);

// Apply EXACT official config - no changes
$egg->name = $official['name'];
$egg->description = $official['description'];
$egg->startup = $official['startup'];
$egg->config_files = $official['config']['files'];
$egg->config_startup = $official['config']['startup'];
$egg->config_logs = $official['config']['logs'];
$egg->config_stop = $official['config']['stop'];
$egg->docker_images = $official['docker_images'];
$egg->script_install = $official['scripts']['installation']['script'];
$egg->script_container = $official['scripts']['installation']['container'];
$egg->script_entry = $official['scripts']['installation']['entrypoint'];
$egg->save();

echo "Egg restored to EXACT official config (no modifications)\n";
echo "Name: " . $egg->name . "\n";
echo "Startup: " . substr($egg->startup, 0, 100) . "...\n";
echo "Docker images: " . count($egg->docker_images) . " options\n";

// Delete all existing variables and recreate from official egg
EggVariable::where('egg_id', 1)->delete();

foreach ($official['variables'] as $v) {
    EggVariable::create([
        'egg_id' => 1,
        'name' => $v['name'],
        'description' => $v['description'],
        'env_variable' => $v['env_variable'],
        'default_value' => $v['default_value'],
        'user_viewable' => $v['user_viewable'],
        'user_editable' => $v['user_editable'],
        'rules' => $v['rules'],
        'field_type' => $v['field_type'] ?? 'text',
    ]);
    echo "  Variable: {$v['env_variable']} = {$v['default_value']}\n";
}

echo "\nVariables: " . EggVariable::where('egg_id', 1)->count() . "\n";

// Update all servers to use the official startup + default image (Nodejs 24)
$count = 0;
foreach (Server::all() as $s) {
    $s->startup = $official['startup'];
    $s->image = 'ghcr.io/ptero-eggs/yolks:nodejs_24';
    $s->save();
    $count++;
}
echo "Updated {$count} servers with official startup\n";
