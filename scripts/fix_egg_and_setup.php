<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Users\UserCreationService;
use Pterodactyl\Services\Servers\ServerCreationService;
use Illuminate\Support\Str;
use Illuminate\Encryption\Encrypter;

// Create admin
$admin = User::where('username', 'admin')->first();
if (!$admin) {
    $us = app(UserCreationService::class);
    $admin = $us->handle([
        'email' => 'admin@deathlegion.local', 'username' => 'admin',
        'name_first' => 'Admin', 'name_last' => 'User',
        'password' => 'DeathLegion2025!', 'root_admin' => true, 'language' => 'en',
    ]);
    echo "Admin: {$admin->id}\n";
} else echo "Admin exists\n";

// Create users
$users = [
    ['tharu7862','Tharu','User','7862162130'], ['zeus','Zeus','User','Zeus'],
    ['cirry-man','Cirry','Man','LopLopto123'], ['dew','Dew','User','2011'],
    ['podda','Podda','User','podda1234'], ['nadun909','Nadun','User','Nadun7777'],
    ['danzo_hutto','Danzo','Hutto','Jela_kariyek'], ['cryneo','Cryneo','User','0009fucker'],
    ['demoxhexa','Demox','Hexa','same'],
];
$us = app(UserCreationService::class);
foreach ($users as $u) {
    if (!User::where('username', $u[0])->exists()) {
        $us->handle(['email'=>$u[0].'@deathlegion.local','username'=>$u[0],'name_first'=>$u[1],'name_last'=>$u[2],'password'=>$u[3],'root_admin'=>false,'language'=>'en']);
        echo "User: {$u[0]}\n";
    }
}

// Location + Node
$loc = Location::firstOrCreate(['short'=>'eu'], ['long'=>'Europe']);
$node = Node::first();
if (!$node) {
    $node = new Node();
    $node->name = 'Death Legion Node'; $node->location_id = $loc->id;
    $node->fqdn = '127.0.0.1'; $node->scheme = 'http'; $node->behind_proxy = true;
    $node->memory = 1024; $node->memory_overallocate = 0; $node->disk = 2048;
    $node->disk_overallocate = 0; $node->upload_size = 100;
    $node->daemonListen = 8080; $node->daemonSFTP = 2022;
    $node->daemonBase = '/var/lib/pterodactyl/volumes';
    $node->daemon_token = app(Encrypter::class)->encrypt(Str::random(40));
    $node->daemon_token_id = Str::random(16);
    $node->save();
    echo "Node: {$node->id}\n";
} else echo "Node exists\n";

// Allocations
for ($p = 25565; $p <= 25600; $p++) {
    Allocation::firstOrCreate(['node_id'=>$node->id,'port'=>$p], ['ip'=>'0.0.0.0','ip_alias'=>null,'server_id'=>null,'notes'=>null]);
}
echo "Allocations: " . Allocation::count() . "\n";

// Egg
$egg = Egg::find(1);
if ($egg) {
    $egg->startup = 'if [ -f /home/container/package.json ]; then npm install; fi; node /home/container/index.js';
    $egg->config_stop = '^C'; $egg->config_files = '{}';
    $egg->config_startup = '{"done":["Server running","Connected","Bot ready"]}';
    $egg->config_logs = '{}';
    $egg->docker_images = ['Nodejs 24' => 'ghcr.io/ptero-eggs/yolks:nodejs_24'];
    $egg->save();
    echo "Egg fixed\n";
}

// Servers
$names = ['Alpha','Beta','Gamma','Delta','Eclipse','Falcon','Ghost','Hunter','Inferno','Jaguar','Knight','Lightning','Matrix','Nova','Omega','Phantom','Quasar','Raven','Shadow','Titan'];
$cs = app(ServerCreationService::class);
$idx = 0;
foreach (User::orderBy('id')->get() as $user) {
    for ($i = 0; $i < 2; $i++) {
        $a = Allocation::whereNull('server_id')->orderBy('port')->first();
        if (!$a) break 2;
        $name = 'DeathLegion ' . ($names[$idx] ?? ('Bot '.($idx+1)));
        try {
            $s = $cs->handle([
                'name'=>$name, 'description'=>'Bot for '.$user->username,
                'owner_id'=>$user->id, 'egg_id'=>1, 'node_id'=>$node->id,
                'location_id'=>$loc->id, 'allocation_id'=>$a->id,
                'environment'=>['MAIN_FILE'=>'index.js','NODE_ARGS'=>'','NODE_PACKAGES'=>'','AUTO_UPDATE'=>'0','GIT_ADDRESS'=>'','BRANCH'=>'','USER_UPLOAD'=>'1'],
                'memory'=>512,'swap'=>0,'disk'=>1024,'io'=>500,'cpu'=>100,
                'feature_limits'=>['databases'=>1,'allocations'=>2,'backups'=>1],
                'startup'=>$egg->startup, 'image'=>'ghcr.io/ptero-eggs/yolks:nodejs_24',
                'skip_scripts'=>true, 'start_on_completion'=>false,
            ]);
            $v = '/var/lib/pterodactyl/volumes/'.$s->uuid;
            @mkdir($v, 0755, true);
            file_put_contents($v.'/index.js', "console.log('Upload your bot files via Files tab');\n");
            chown($v.'/index.js', 'pterodactyl'); chgrp($v.'/index.js', 'pterodactyl');
            echo "Created: {$name}\n";
            $idx++;
        } catch (\Exception $e) {
            echo "ERR: {$name}: ".substr($e->getMessage(),0,80)."\n";
        }
    }
}
echo "Total: {$idx} servers, ".User::count()." users\n";
