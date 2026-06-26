<?php
// Back up large file
$src = "/home/storika/storika/data.json";
$bak = "/home/storika/storika/data_backup.json";
if (file_exists($src)) {
    copy($src, $bak);
    echo "Backed up: " . filesize($src) . " bytes\n";
    // Create fresh empty data
    $fresh = json_encode(["stories" => [], "episodes" => [], "comments" => []]);
    file_put_contents($src, $fresh);
    echo "Created fresh data.json\n";
} else {
    echo "No data.json found\n";
}
// Kill the process
$fp = popen("kill $(ps aux | grep 'node server/server.js' | grep -v grep | awk '{print $2}') 2>&1", "r");
$out = stream_get_contents($fp);
pclose($fp);
echo "Killed\n";
