<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$db_host = 'localhost';
$db_name = 'storika_storika';
$db_user = 'storika';
$db_pass = 'Rt[6tmU2H97W.l';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$headers = getallheaders();
$auth_user = null;

// --- AUTH ---
function genToken() { return bin2hex(random_bytes(32)); }

// Verify session from Authorization header
$token = '';
if (isset($headers['Authorization'])) {
    $parts = explode(' ', $headers['Authorization']);
    if (count($parts) === 2) $token = $parts[1];
}
if (empty($token) && isset($input['token'])) $token = $input['token'];

if ($token) {
    $stmt = $conn->prepare("SELECT u.id, u.name, u.email, u.role FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = ? AND s.expires > NOW()");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $auth_user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
}

function requireAuth() {
    global $auth_user;
    if (!$auth_user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

function mapStory($row) {
    if (!$row) return null;
    $row['coverImage'] = $row['cover_image'] ?? '';
    $row['createdAt'] = $row['created_at'] ?? '';
    $row['updatedAt'] = $row['updated_at'] ?? '';
    unset($row['cover_image'], $row['created_at'], $row['updated_at']);
    return $row;
}

function mapComment($row) {
    if (!$row) return null;
    $row['createdAt'] = $row['created_at'] ?? '';
    unset($row['created_at']);
    return $row;
}

function mapEpisode($row) {
    if (!$row) return null;
    $row['number'] = $row['episode_number'] ?? 0;
    unset($row['episode_number']);
    return $row;
}

// --- ROUTES ---
switch ($action) {

    case 'login':
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$user || !password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            exit;
        }
        $token = genToken();
        $stmt = $conn->prepare("INSERT INTO sessions (user_id, token, expires) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))");
        $stmt->bind_param('is', $user['id'], $token);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['token' => $token, 'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']]]);
        break;

    case 'logout':
        if ($token) {
            $stmt = $conn->prepare("DELETE FROM sessions WHERE token = ?");
            $stmt->bind_param('s', $token);
            $stmt->execute();
            $stmt->close();
        }
        echo json_encode(['ok' => true]);
        break;

    case 'check-auth':
        echo json_encode(['authenticated' => !!$auth_user, 'user' => $auth_user]);
        break;

    case 'change-password':
        requireAuth();
        $old = $input['oldPassword'] ?? '';
        $new = $input['newPassword'] ?? '';
        $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->bind_param('i', $auth_user['id']);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row || !password_verify($old, $row['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Current password is incorrect']);
            exit;
        }
        $hash = password_hash($new, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->bind_param('si', $hash, $auth_user['id']);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    // --- STORIES ---
    case 'list-stories':
        $stmt = $conn->query("SELECT * FROM stories ORDER BY created_at DESC");
        $rows = $stmt->fetch_all(MYSQLI_ASSOC) ?: [];
        echo json_encode(array_map('mapStory', $rows));
        break;

    case 'get-story':
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("SELECT * FROM stories WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $story = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        echo json_encode(mapStory($story));
        break;

    case 'save-story':
        requireAuth();
        $title = $input['title'] ?? '';
        $content = $input['content'] ?? '';
        $category = $input['category'] ?? '';
        $author = $input['author'] ?? '';
        $cover = $input['coverImage'] ?? $input['cover'] ?? '';
        $type_val = $input['type'] ?? 'single';
        $status_val = $input['status'] ?? 'published';

        if (isset($input['id']) && $input['id']) {
            $stmt = $conn->prepare("UPDATE stories SET title=?, content=?, category=?, author=?, cover_image=?, type=?, status=? WHERE id=?");
            $stmt->bind_param('sssssssi', $title, $content, $category, $author, $cover, $type_val, $status_val, $input['id']);
            $stmt->execute();
            $stmt->close();
            $id = $input['id'];
        } else {
            $stmt = $conn->prepare("INSERT INTO stories (title, content, category, author, cover_image, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param('sssssss', $title, $content, $category, $author, $cover, $type_val, $status_val);
            $stmt->execute();
            $id = $stmt->insert_id;
            $stmt->close();
        }
        echo json_encode(['id' => $id]);
        break;

    case 'delete-story':
        requireAuth();
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM stories WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    case 'increment-view':
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("UPDATE stories SET views = views + 1 WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt2 = $conn->prepare("SELECT views FROM stories WHERE id = ?");
        $stmt2->bind_param('i', $id);
        $stmt2->execute();
        $r = $stmt2->get_result()->fetch_assoc();
        $stmt->close();
        $stmt2->close();
        echo json_encode(['views' => $r ? (int)$r['views'] : 0]);
        break;

    // --- EPISODES ---
    case 'list-episodes':
        $story_id = (int)($input['story_id'] ?? 0);
        $stmt = $conn->prepare("SELECT * FROM episodes WHERE story_id = ? ORDER BY episode_number ASC");
        $stmt->bind_param('i', $story_id);
        $stmt->execute();
        echo json_encode(array_map('mapEpisode', $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: []));
        $stmt->close();
        break;

    case 'save-episode':
        requireAuth();
        $story_id = (int)$input['story_id'];
        $title = $input['title'] ?? '';
        $content = $input['content'] ?? '';
        $ep_num = (int)($input['episode_number'] ?? $input['number'] ?? 1);

        if (isset($input['id']) && $input['id']) {
            $stmt = $conn->prepare("UPDATE episodes SET title=?, content=?, episode_number=? WHERE id=?");
            $stmt->bind_param('ssii', $title, $content, $ep_num, $input['id']);
            $stmt->execute();
            $stmt->close();
            $id = $input['id'];
        } else {
            $stmt = $conn->prepare("INSERT INTO episodes (story_id, title, content, episode_number) VALUES (?, ?, ?, ?)");
            $stmt->bind_param('issi', $story_id, $title, $content, $ep_num);
            $stmt->execute();
            $id = $stmt->insert_id;
            $stmt->close();
        }
        echo json_encode(['id' => $id]);
        break;

    case 'delete-episode':
        requireAuth();
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM episodes WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    // --- COMMENTS ---
    case 'list-comments':
        $story_id = (int)($input['story_id'] ?? 0);
        $stmt = $conn->prepare("SELECT * FROM comments WHERE story_id = ? ORDER BY created_at DESC");
        $stmt->bind_param('i', $story_id);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];
        $stmt->close();
        echo json_encode(array_map('mapComment', $rows));
        break;

    case 'save-comment':
        $story_id = (int)$input['story_id'];
        $author = $input['author'] ?? 'Anonymous';
        $content = $input['content'] ?? '';
        $stmt = $conn->prepare("INSERT INTO comments (story_id, author, content) VALUES (?, ?, ?)");
        $stmt->bind_param('iss', $story_id, $author, $content);
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();
        echo json_encode(['id' => $id]);
        break;

    case 'delete-comment':
        requireAuth();
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    case 'list-comments-all':
        $stmt = $conn->query("SELECT c.*, s.title AS storyTitle FROM comments c JOIN stories s ON c.story_id = s.id ORDER BY c.created_at DESC");
        echo json_encode(array_map('mapComment', $stmt->fetch_all(MYSQLI_ASSOC) ?: []));
        break;

    case 'delete-comment':
        requireAuth();
        $id = (int)($input['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    // --- SETTINGS ---
    case 'get-settings':
        $stmt = $conn->query("SELECT `key` AS setting_key, `value` AS setting_value FROM settings");
        echo json_encode($stmt->fetch_all(MYSQLI_ASSOC) ?: []);
        break;

    case 'save-setting':
        requireAuth();
        $key = $input['key'] ?? '';
        $value = $input['value'] ?? '';
        $stmt = $conn->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
        $stmt->bind_param('sss', $key, $value, $value);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    // --- USERS (admin only) ---
    case 'list-users':
        requireAuth();
        if ($auth_user['role'] !== 'admin') { http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit; }
        $stmt = $conn->query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC");
        echo json_encode($stmt->fetch_all(MYSQLI_ASSOC) ?: []);
        break;

    case 'delete-user':
        requireAuth();
        if ($auth_user['role'] !== 'admin') { http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit; }
        $id = (int)($input['id'] ?? 0);
        if ($id === $auth_user['id']) { http_response_code(400); echo json_encode(['error' => 'Cannot delete yourself']); exit; }
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['ok' => true]);
        break;

    // --- SEED / RESET ---
    case 'seed':
        requireAuth();
        if ($auth_user['role'] !== 'admin') { http_response_code(403); exit; }
        $sample = [
            ['title'=>'Hadithi ya Siku', 'content'=>'Siku moja...', 'category'=>'Fiction', 'author'=>'Admin'],
            ['title'=>'Upendo na Amani', 'content'=>'Kwenye kijiji...', 'category'=>'Romance', 'author'=>'Admin'],
        ];
        foreach ($sample as $s) {
            $stmt = $conn->prepare("INSERT INTO stories (title, content, category, author, status) VALUES (?, ?, ?, ?, 'published')");
            $stmt->bind_param('ssss', $s['title'], $s['content'], $s['category'], $s['author']);
            $stmt->execute();
            $stmt->close();
        }
        echo json_encode(['ok' => true]);
        break;

    case 'reset':
        requireAuth();
        if ($auth_user['role'] !== 'admin') { http_response_code(403); exit; }
        $conn->query("DELETE FROM comments");
        $conn->query("DELETE FROM episodes");
        $conn->query("DELETE FROM stories");
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Unknown action', 'action' => $action]);
}

$conn->close();
