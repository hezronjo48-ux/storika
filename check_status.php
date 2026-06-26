<?php
$fp = popen("ps aux | grep \"node server\" | grep -v grep", "r");
$out = stream_get_contents($fp);
pclose($fp);
echo "Node: " . ($out ? "RUNNING" : "DEAD") . "\n";
$fp2 = popen("cat /home/storika/storika/data.json 2>/dev/null", "r");
$out2 = stream_get_contents($fp2);
pclose($fp2);
echo "Data: " . ($out2 ?: "NO FILE") . "\n";
