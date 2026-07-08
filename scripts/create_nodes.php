<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Str;
use Illuminate\Encryption\Encrypter;

$loc = Location::firstOrCreate(['short'=>'eu'], ['long'=>'Europe']);

$sandboxes = [
    ['f5a3ce9a-eb83-44a9-8f05-33eee5848b04', 'Wings Node 2'],
    ['3c575ec2-0e0e-46b6-8c28-4aaf329394a9', 'Wings Node 3'],
    ['0f1a0854-02dd-4a42-8bda-6b73c2efa738', 'Wings Node 4'],
    ['fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d', 'Wings Node 5'],
];

foreach ($sandboxes as $ws) {
    $fqdn = '8000-' . $ws[0] . '.daytonaproxy01.eu';
    if (Node::where('fqdn', $fqdn)->exists()) {
        echo "Exists: " . $ws[1] . "\n";
        continue;
    }
    $n = new Node();
    $n->uuid = Str::uuid();
    $n->name = $ws[1];
    $n->location_id = $loc->id;
    $n->fqdn = $fqdn;
    $n->scheme = 'https';
    $n->behind_proxy = true;
    $n->memory = 1024;
    $n->memory_overallocate = 0;
    $n->disk = 2048;
    $n->disk_overallocate = 0;
    $n->upload_size = 100;
    $n->daemonListen = 443;
    $n->daemonSFTP = 2022;
    $n->daemonBase = '/var/lib/pterodactyl/volumes';
    $n->daemon_token = app(Encrypter::class)->encrypt(Str::random(40));
    $n->daemon_token_id = Str::random(16);
    $n->save();

    $base = 25600 + ($n->id - 1) * 10;
    for ($p = $base; $p < $base + 10; $p++) {
        Allocation::create(['node_id'=>$n->id, 'ip'=>'0.0.0.0', 'port'=>$p, 'ip_alias'=>null, 'server_id'=>null, 'notes'=>null]);
    }

    echo "Created: " . $ws[1] . " (ID:" . $n->id . ") TOKEN_ID:" . $n->daemon_token_id . " TOKEN:" . $n->getDecryptedKey() . "\n";
}
echo "Total nodes: " . Node::count() . "\n";
