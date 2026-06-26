<?php
$file = "/home/storika/storika/data.json";
if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    echo "FILE NOT FOUND";
}
