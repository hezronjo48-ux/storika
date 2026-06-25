// ====== DATABASE ======
const DB = {
  getUsers() { return JSON.parse(localStorage.getItem('storika_users') || '[]'); },
  setUsers(u) { localStorage.setItem('storika_users', JSON.stringify(u)); },
  getStories() { return JSON.parse(localStorage.getItem('storika_stories') || '[]'); },
  setStories(s) { localStorage.setItem('storika_stories', JSON.stringify(s)); },
  getComments(storyId) { return JSON.parse(localStorage.getItem('storika_comments_' + storyId) || '[]'); },
  setComments(storyId, c) { localStorage.setItem('storika_comments_' + storyId, JSON.stringify(c)); },
  getAllComments() {
    const stories = this.getStories();
    let all = [];
    stories.forEach(s => {
      const cs = this.getComments(s.id);
      cs.forEach(c => { c.storyTitle = s.title; all.push(c); });
    });
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  getNextId() { return Date.now(); },
  getSession() { return localStorage.getItem('storika_session') || null; },
  setSession(email) { if (email) localStorage.setItem('storika_session', email); else localStorage.removeItem('storika_session'); },
  getEpisodes(storyId) { return JSON.parse(localStorage.getItem('storika_episodes_' + storyId) || '[]'); },
  setEpisodes(storyId, eps) { localStorage.setItem('storika_episodes_' + storyId, JSON.stringify(eps)); }
};

// ====== TOAST ======
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ====== THEME ======
(function() {
  const saved = localStorage.getItem('storika-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '&#9790;' : '&#9728;';
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('storika-theme', next);
      btn.innerHTML = next === 'dark' ? '&#9790;' : '&#9728;';
    });
  }
})();

// ====== SIDEBAR TOGGLE ======
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
});
document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
});

// ====== AUTH ======
function seedDefaultAdmin() {
  const users = DB.getUsers();
  if (users.length === 0) {
    DB.setUsers([{ name: 'Admin', email: 'admin@storika.co.tz', password: hashPass('admin123'), role: 'admin', createdAt: new Date().toISOString() }]);
  }
}
seedDefaultAdmin();
let editingStoryId = null;
let _defCoverCache = null;
function defCover() {
  if (!_defCoverCache) {
    _defCoverCache = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect width=%22400%22 height=%22200%22 fill=%22%230A2342%22/%3E%3Ctext x=%22200%22 y=%22110%22 font-family=%22sans-serif%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22%23D4AF37%22%3E📖%3C/text%3E%3C/svg%3E';
  }
  return _defCoverCache;
}
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function checkAuth() {
  const session = DB.getSession();
  if (session) {
    const users = DB.getUsers();
    const user = users.find(u => u.email === session);
    if (user) {
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('dashboardSection').style.display = 'block';
      document.getElementById('sidebarName').textContent = user.name;
      document.getElementById('sidebarAvatar').textContent = user.name.charAt(0).toUpperCase();
      renderDashboard();
      return;
    }
  }
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('dashboardSection').style.display = 'none';
}

function hashPass(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { const c = p.charCodeAt(i); h = ((h << 5) - h) + c; h |= 0; }
  return 'h' + Math.abs(h).toString(16);
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const error = document.getElementById('loginError');
  const success = document.getElementById('loginSuccess');
  error.style.display = 'none';
  success.style.display = 'none';

  const users = DB.getUsers();
  const user = users.find(u => u.email === email && u.password === hashPass(password));
  if (!user) {
    error.textContent = 'Barua pepe au nywila si sahihi';
    error.style.display = 'block';
    return;
  }
  DB.setSession(email);
  success.textContent = 'Umeingia kwa mafanikio!';
  success.style.display = 'block';
  setTimeout(checkAuth, 500);
});

document.getElementById('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const error = document.getElementById('registerError');
  const success = document.getElementById('registerSuccess');
  error.style.display = 'none';
  success.style.display = 'none';

  if (!name || !email || !password) {
    error.textContent = 'Tafadhali jaza taarifa zote';
    error.style.display = 'block';
    return;
  }
  let users = DB.getUsers();
  if (users.find(u => u.email === email)) {
    error.textContent = 'Barua pepe hii tayari imesajiliwa';
    error.style.display = 'block';
    return;
  }
  const role = users.length === 0 ? 'admin' : 'user';
  users.push({ name, email, password: hashPass(password), role, createdAt: new Date().toISOString() });
  DB.setUsers(users);
  success.textContent = 'Umesajiliwa kwa mafanikio! Sasa unaweza kuingia.';
  success.style.display = 'block';
  document.getElementById('registerForm').reset();
});

document.getElementById('showRegister').addEventListener('click', () => {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('registerCard').style.display = 'block';
});
document.getElementById('showLogin').addEventListener('click', () => {
  document.getElementById('loginCard').style.display = 'block';
  document.getElementById('registerCard').style.display = 'none';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  DB.setSession(null);
  checkAuth();
  showToast('Umetoka!', 'success');
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
});

// ====== DASHBOARD ======
function renderDashboard() {
  const stories = DB.getStories();
  const totalViews = stories.reduce((sum, s) => sum + (s.views || 0), 0);
  const allComments = DB.getAllComments();

  document.getElementById('storiesCount').textContent = stories.length;
  document.getElementById('commentsCount').textContent = allComments.length;

  document.getElementById('statsSection').innerHTML = `
    <div class="stat-card-modern">
      <div class="stat-header">
        <div class="stat-icon">&#128214;</div>
        <div class="stat-number">${stories.length}</div>
      </div>
      <div class="stat-label">Jumla ya Hadithi</div>
      <div class="stat-trend up">&#9650; ${stories.length > 0 ? 'Imesajiliwa' : 'Hakuna bado'}</div>
    </div>
    <div class="stat-card-modern">
      <div class="stat-header">
        <div class="stat-icon">&#128065;</div>
        <div class="stat-number">${totalViews}</div>
      </div>
      <div class="stat-label">Jumla ya Wasomaji</div>
      <div class="stat-trend up">&#9650; ${totalViews > 0 ? 'Inaendelea vizuri' : 'Hakuna bado'}</div>
    </div>
    <div class="stat-card-modern">
      <div class="stat-header">
        <div class="stat-icon">&#128172;</div>
        <div class="stat-number">${allComments.length}</div>
      </div>
      <div class="stat-label">Maoni</div>
      <div class="stat-trend ${allComments.length > 0 ? 'up' : 'down'}">${allComments.length > 0 ? '&#9650; Watu wanajadili' : 'Hakuna maoni bado'}</div>
    </div>`;

  const st = document.getElementById('storiesTable');
  if (stories.length) {
    st.innerHTML = `<table class="admin-table-modern"><thead><tr><th>#</th><th>Picha</th><th>Jina</th><th>Aina</th><th>Mwandishi</th><th>Wasomaji</th><th>Imeongezwa</th><th>Vitendo</th></tr></thead><tbody>
      ${stories.map((s, i) => `<tr>
        <td>${i+1}</td>
        <td class="td-img"><img src="${s.coverImage || defCover()}" alt=""></td>
        <td><strong>${escHtml(s.title)}</strong></td>
        <td><span class="type-badge ${s.type === 'series' ? 'series' : 'single'}">${s.type === 'series' ? 'Mfululizo' : 'Moja'}</span></td>
        <td>${escHtml(s.author || 'Mwandishi wa STORIKA')}</td>
        <td><span class="views-badge">&#128065; ${s.views || 0}</span></td>
        <td style="font-size:13px;color:var(--text-light);">${s.createdAt ? new Date(s.createdAt).toLocaleDateString('sw-TZ') : '-'}</td>
        <td><div class="actions">
          <button class="btn-sm-modern edit" data-edit="${s.id}">Hariri</button>
          ${s.type === 'series' ? `<button class="btn-sm-modern episodes" data-episodes="${s.id}">Episodes (${DB.getEpisodes(s.id).length})</button>` : ''}
          <button class="btn-sm-modern delete" data-del="${s.id}">Futa</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
  } else {
    st.innerHTML = `<div class="empty-state">
      <div class="empty-icon">&#128214;</div>
      <h3>Hakuna Hadithi</h3>
      <p>Bonyeza "+ Ongeza Hadithi Mpya" au "Pakia Hadithi Sampuli" kuanza.</p>
    </div>`;
  }

  const ct = document.getElementById('commentsList');
  if (allComments.length) {
    // Group comments by story title
    const groups = {};
    allComments.forEach(c => {
      const key = c.storyTitle || 'Hajulikani';
      if (!groups[key]) groups[key] = { title: key, comments: [] };
      groups[key].comments.push(c);
    });

    ct.innerHTML = Object.values(groups).map(g => `
      <div class="comment-story-group">
        <div class="story-group-header" data-sg-toggle="${escHtml(g.title)}">
          <div class="sg-left">
            <div class="sg-icon">&#128214;</div>
            <span class="sg-title">${escHtml(g.title)}</span>
            <span class="sg-count">${g.comments.length} maoni</span>
          </div>
          <span class="sg-arrow">&#9660;</span>
        </div>
        <div class="story-group-body">
          ${g.comments.map(c => `
            <div class="comment-card" style="border-radius:0;border:none;border-bottom:1px solid var(--border);box-shadow:none;margin:0;">
              <div class="comment-head">
                <div class="comment-author">
                  <div class="comment-avatar">${escHtml(c.name.charAt(0).toUpperCase())}</div>
                  <div>
                    <div class="comment-name">${escHtml(c.name)}</div>
                    <div class="comment-story">kwenye ${escHtml(c.storyTitle)}</div>
                  </div>
                </div>
                <small style="font-size:12px;color:var(--text-light);">${new Date(c.createdAt).toLocaleDateString('sw-TZ')}</small>
              </div>
              <div class="comment-text">${escHtml(c.comment)}</div>
              <div class="comment-footer">
                <span></span>
                <a href="#" data-del-comment="${c.storyId}|${c.id}" style="color:#dc3545;font-size:12px;font-weight:600;text-decoration:none;">Futa Maoni</a>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('');

    // Toggle story groups
    document.querySelectorAll('[data-sg-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        const arrow = header.querySelector('.sg-arrow');
        body.classList.toggle('open');
        arrow.classList.toggle('open');
      });
    });
  } else {
    ct.innerHTML = `<div class="empty-state">
      <div class="empty-icon">&#128172;</div>
      <h3>Hakuna Maoni</h3>
      <p>Hakuna maoni kutoka kwa wasomaji bado.</p>
    </div>`;
  }

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.removeEventListener('click', handleTabClick);
    btn.addEventListener('click', handleTabClick);
  });

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteStory(parseInt(btn.dataset.del)));
  });

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.edit)));
  });

  document.querySelectorAll('[data-del-comment]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const [sid, cid] = a.dataset.delComment.split('|');
      deleteComment(parseInt(sid), parseInt(cid));
    });
  });

  document.querySelectorAll('[data-episodes]').forEach(btn => {
    btn.addEventListener('click', () => openEpisodesModal(parseInt(btn.dataset.episodes)));
  });

  updateMaintenanceUI();
}

function handleTabClick() {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  this.classList.add('active');
  document.getElementById('tab-' + this.dataset.tab).style.display = 'block';
}

// ====== FILE UPLOAD ======
var _newCoverDataURL = null;
var _editCoverDataURL = null;

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ====== ADD STORY ======
document.getElementById('addStoryBtn').addEventListener('click', () => {
  document.getElementById('addModal').classList.add('active');
  document.getElementById('newTitle').value = '';
  document.getElementById('newAuthor').value = '';
  document.getElementById('newType').value = 'single';
  document.getElementById('newCover').value = '';
  document.getElementById('newCoverFile').value = '';
  document.getElementById('newContent').value = '';
  document.getElementById('newCoverPreview').style.display = 'none';
  _newCoverDataURL = null;
  document.getElementById('newEpisodesSection').style.display = 'none';
  document.getElementById('newContentSection').style.display = 'block';
  const list = document.getElementById('newEpisodesList');
  list.innerHTML = '<div class="episode-item" data-ep-row="0"><div class="ep-header"><div class="ep-number">1</div><input type="text" class="new-ep-title" placeholder="Jina la episode" style="flex:1;margin-left:10px;padding:10px 14px;background:var(--bg-alt);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:inherit;"></div><textarea class="new-ep-content" placeholder="Maudhui ya episode..." style="margin-top:8px;"></textarea></div>';
});

document.getElementById('closeAddModalBtn').addEventListener('click', () => document.getElementById('addModal').classList.remove('active'));
document.getElementById('addModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('addModal').classList.remove('active'); });

document.getElementById('newType').addEventListener('change', () => {
  const isSeries = document.getElementById('newType').value === 'series';
  document.getElementById('newEpisodesSection').style.display = isSeries ? 'block' : 'none';
  document.getElementById('newContentSection').style.display = isSeries ? 'none' : 'block';
});

document.getElementById('newCoverChooseBtn').addEventListener('click', () => document.getElementById('newCoverFile').click());
document.getElementById('newCoverFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  _newCoverDataURL = await readFileAsDataURL(file);
  const preview = document.getElementById('newCoverPreview');
  preview.src = _newCoverDataURL;
  preview.style.display = 'block';
  document.getElementById('newCover').value = '';
});

document.getElementById('newCover').addEventListener('input', () => {
  const preview = document.getElementById('newCoverPreview');
  const val = document.getElementById('newCover').value.trim();
  if (val) { preview.src = val; preview.style.display = 'block'; _newCoverDataURL = null; }
  else if (!_newCoverDataURL) preview.style.display = 'none';
});

document.getElementById('saveNewStoryBtn').addEventListener('click', () => {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) return showToast('Jina la hadithi linahitajika', 'error');
  const stories = DB.getStories();
  const id = DB.getNextId();
  const type = document.getElementById('newType').value;
  stories.unshift({
    id: id,
    title,
    author: document.getElementById('newAuthor').value.trim() || 'Mwandishi wa STORIKA',
    type: type,
    coverImage: _newCoverDataURL || document.getElementById('newCover').value.trim() || '',
    content: type === 'series' ? '' : document.getElementById('newContent').value,
    views: 0,
    createdAt: new Date().toISOString()
  });
  DB.setStories(stories);

  if (type === 'series') {
    const epTitles = document.querySelectorAll('.new-ep-title');
    const epContents = document.querySelectorAll('.new-ep-content');
    const eps = [];
    epTitles.forEach((input, i) => {
      const epTitle = input.value.trim();
      if (epTitle) {
        eps.push({
          id: DB.getNextId() + i + 1,
          storyId: id,
          title: epTitle,
          number: eps.length + 1,
          content: epContents[i] ? epContents[i].value : '',
          createdAt: new Date().toISOString()
        });
      }
    });
    if (eps.length) DB.setEpisodes(id, eps);
  }

  document.getElementById('addModal').classList.remove('active');
  _newCoverDataURL = null;
  showToast('Hadithi imeongezwa!', 'success');
  // Notify public site of new story
  localStorage.setItem('storika_notify_story', JSON.stringify({ title: title, time: Date.now() }));
  renderDashboard();
});

// ====== EDIT STORY ======
function openEditModal(id) {
  const stories = DB.getStories();
  const story = stories.find(s => s.id === id);
  if (!story) return;
  editingStoryId = id;
  _editCoverDataURL = null;
  document.getElementById('editTitle').value = story.title;
  document.getElementById('editAuthor').value = story.author || '';
  document.getElementById('editType').value = story.type || 'single';
  document.getElementById('editCover').value = story.coverImage || '';
  document.getElementById('editCoverFile').value = '';
  document.getElementById('editContent').value = story.content || '';
  const preview = document.getElementById('editCoverPreview');
  if (story.coverImage) { preview.src = story.coverImage; preview.style.display = 'block'; }
  else preview.style.display = 'none';
  document.getElementById('editModal').classList.add('active');
  // Show/hide content section based on type
  const isSeries = story.type === 'series';
  document.getElementById('editContentSection').style.display = isSeries ? 'none' : 'block';
}

document.getElementById('editType').addEventListener('change', () => {
  const isSeries = document.getElementById('editType').value === 'series';
  document.getElementById('editContentSection').style.display = isSeries ? 'none' : 'block';
});

document.getElementById('closeEditModalBtn').addEventListener('click', () => { document.getElementById('editModal').classList.remove('active'); editingStoryId = null; _editCoverDataURL = null; });
document.getElementById('editModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) { document.getElementById('editModal').classList.remove('active'); editingStoryId = null; _editCoverDataURL = null; } });

document.getElementById('editCoverChooseBtn').addEventListener('click', () => document.getElementById('editCoverFile').click());
document.getElementById('editCoverFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  _editCoverDataURL = await readFileAsDataURL(file);
  const preview = document.getElementById('editCoverPreview');
  preview.src = _editCoverDataURL;
  preview.style.display = 'block';
  document.getElementById('editCover').value = '';
});

document.getElementById('editCover').addEventListener('input', () => {
  const preview = document.getElementById('editCoverPreview');
  const val = document.getElementById('editCover').value.trim();
  if (val) { preview.src = val; preview.style.display = 'block'; _editCoverDataURL = null; }
  else if (!_editCoverDataURL) preview.style.display = 'none';
});

document.getElementById('updateStoryBtn').addEventListener('click', () => {
  if (!editingStoryId) return;
  const title = document.getElementById('editTitle').value.trim();
  if (!title) return showToast('Jina la hadithi linahitajika', 'error');
  const stories = DB.getStories();
  const story = stories.find(s => s.id === editingStoryId);
  if (!story) return;
  story.title = title;
  story.author = document.getElementById('editAuthor').value.trim() || 'Mwandishi wa STORIKA';
  story.type = document.getElementById('editType').value;
  story.coverImage = _editCoverDataURL || document.getElementById('editCover').value.trim() || '';
  story.content = story.type === 'series' ? '' : document.getElementById('editContent').value;
  DB.setStories(stories);
  document.getElementById('editModal').classList.remove('active');
  editingStoryId = null;
  _editCoverDataURL = null;
  showToast('Hadithi imehifadhiwa!', 'success');
  renderDashboard();
});

// ====== DELETE ======
function deleteStory(id) {
  if (!confirm('Una uhakika unataka kufuta hadithi hii?')) return;
  let stories = DB.getStories();
  stories = stories.filter(s => s.id !== id);
  DB.setStories(stories);
  localStorage.removeItem('storika_comments_' + id);
  showToast('Hadithi imefutwa!', 'success');
  renderDashboard();
}

function deleteComment(storyId, commentId) {
  if (!confirm('Una uhakika unataka kufuta maoni haya?')) return;
  let comments = DB.getComments(storyId);
  comments = comments.filter(c => c.id !== commentId);
  DB.setComments(storyId, comments);
  showToast('Maoni yamefutwa!', 'success');
  renderDashboard();
}

// ====== EPISODES ======
var _episodesStoryId = null;

function openEpisodesModal(storyId) {
  _episodesStoryId = storyId;
  const stories = DB.getStories();
  const story = stories.find(s => s.id === storyId);
  if (!story) return;
  document.getElementById('episodesModalTitle').textContent = 'Episodes - ' + story.title;
  document.getElementById('newEpisodeTitle').value = '';
  renderEpisodesList(storyId);
  document.getElementById('episodesModal').classList.add('active');
}

function renderEpisodesList(storyId) {
  const eps = DB.getEpisodes(storyId);
  const list = document.getElementById('episodesList');
  if (!eps.length) {
    list.innerHTML = '<div class="empty-state" style="padding:30px 20px;"><div class="empty-icon" style="font-size:40px;">📄</div><h3>Hakuna Episodes</h3><p>Ongeza episode mpya hapo juu.</p></div>';
    return;
  }
  list.innerHTML = eps.map((ep, i) => `
    <div class="episode-item">
      <div class="ep-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="ep-number">${ep.number}</div>
          <span class="ep-title">${escHtml(ep.title)}</span>
        </div>
        <button class="btn-sm-modern delete" data-del-episode="${storyId}|${ep.id}" style="font-size:11px;">Futa</button>
      </div>
      <textarea data-ep-content="${ep.id}">${ep.content || ''}</textarea>
      <button class="btn-sm-modern episodes" data-save-ep="${storyId}|${ep.id}" style="margin-top:8px;">Hifadhi</button>
    </div>`).join('');

  document.querySelectorAll('[data-del-episode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [sid, eid] = btn.dataset.delEpisode.split('|');
      deleteEpisode(parseInt(sid), parseInt(eid));
    });
  });

  document.querySelectorAll('[data-save-ep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [sid, eid] = btn.dataset.saveEp.split('|');
      const textarea = document.querySelector(`[data-ep-content="${eid}"]`);
      saveEpisode(parseInt(sid), parseInt(eid), textarea.value);
    });
  });
}

document.getElementById('addEpisodeBtn').addEventListener('click', () => {
  if (!_episodesStoryId) return;
  const title = document.getElementById('newEpisodeTitle').value.trim();
  if (!title) return showToast('Jina la episode linahitajika', 'error');
  const eps = DB.getEpisodes(_episodesStoryId);
  const number = eps.length + 1;
  eps.push({ id: DB.getNextId(), storyId: _episodesStoryId, title, number, content: '', createdAt: new Date().toISOString() });
  DB.setEpisodes(_episodesStoryId, eps);
  document.getElementById('newEpisodeTitle').value = '';
  renderEpisodesList(_episodesStoryId);
  showToast('Episode imeongezwa!', 'success');
  renderDashboard();
});

document.getElementById('closeEpisodesModalBtn').addEventListener('click', () => { document.getElementById('episodesModal').classList.remove('active'); _episodesStoryId = null; });
document.getElementById('episodesModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) { document.getElementById('episodesModal').classList.remove('active'); _episodesStoryId = null; } });

function saveEpisode(storyId, epId, content) {
  const eps = DB.getEpisodes(storyId);
  const ep = eps.find(e => e.id === epId);
  if (!ep) return;
  ep.content = content;
  DB.setEpisodes(storyId, eps);
  showToast('Episode imehifadhiwa!', 'success');
}

function deleteEpisode(storyId, epId) {
  if (!confirm('Una uhakika unataka kufuta episode hii?')) return;
  let eps = DB.getEpisodes(storyId);
  eps = eps.filter(e => e.id !== epId);
  eps = eps.map((e, i) => { e.number = i + 1; return e; });
  DB.setEpisodes(storyId, eps);
  renderEpisodesList(storyId);
  renderDashboard();
  showToast('Episode imefutwa!', 'success');
}

// ====== SEED & RESET ======
document.getElementById('seedBtn').addEventListener('click', () => {
  const existing = DB.getStories();
  if (existing.length > 0 && !confirm('Hii itaongeza hadithi sampuli. Ikiwa tayari kuna hadithi, unaweza kupata nakala rudufu. Endelea?')) return;

  const samples = [
    { title: 'Sungura na Kobe', author: 'Hadithi za Kiasili', content: '<p>Sungura na Kobe walikuwa marafiki wakubwa. Siku moja, Sungura alimwalika Kobe kwenye sherehe ya chakula kikubwa. Kobe alifurahi sana na akaanza safari yake kwenda nyumbani kwa Sungura.</p><p>Njiani, Kobe alikutana na changamoto nyingi. Alitembea polepole kwa sababu alikuwa na ganda zito mgongoni. Lakini hakuacha, aliendelea mbele.</p><p>Wakati huo huo, Sungura alikuwa akijiandaa kwa sherehe. Alifikiri Kobe hatakuja kwa sababu anaenda polepole. Lakini Kobe alifika baada ya muda mrefu.</p><p>Wote wawili walifurahi na kula pamoja. Sungura alijifunza kuwa ni muhimu kusubiri na kuwathamini marafiki wako wote bila kujali kasi yao.</p>' },
    { title: 'Mfalme Simba na Panya', author: 'Hadithi za Kiasili', content: '<p>Siku moja, Mfalme Simba alikuwa amelala usingizi mzito. Panya mdogo alikimbia bila tahadhari na kumkanyaga Simba. Simba aliamka kwa hasira na kumkamata Panya.</p><p>"Tafadhali nisamehe, Mfalme!" Panya aliomba kwa hofu. "Acha niende, na siku moja nitakusaidia!"</p><p>Simba alicheka kwa dharau. "Wewe mdogo kama nini unaweza kunisaidia?" Lakini alimwacha aende.</p><p>Siku zilivyopita, Simba alitegwa na wawindaji. Alipigana lakini hakuweza kujikomboa. Panya alisikia kilio cha Simba na akaja kumsaidia. Alikata nyavu kwa meno yake makali hadi Simba akaachiliwa.</p><p>Simba alimshukuru Panya na kutambua kuwa kila mtu ana thamani yake, hata kama ni mdogo.</p>' },
    { title: 'Nguvumali na Majini', author: 'Mohamed S. Mohamed', content: '<p>Nguvumali alikuwa kijana shujaa aliyeishi kijijini. Siku moja alisikia sauti za ajabu zikitoka mtoni. Aliamua kuchunguza.</p><p>Alipofika mtoni, aliona majini wakicheza na kuimba. Walimwona na kumwalika kujiunga nao. Nguvumali alikubali na akawa rafiki yao.</p><p>Majini walimpa Nguvumali nguvu za ajabu na uwezo wa kuzungumza na wanyama. Alitumia nguvu zake kusaidia watu kijijini.</p><p>Lakini alionya kuwa hutakiwi kutumia nguvu kwa ubaya. Nguvumali alifuata ushauri wao na kuwa kiongozi mwema wa kijiji chake.</p>' },
    { title: 'Maua ya Mungu', author: 'Mwandishi wa STORIKA', content: '<p>Maua ya Mungu ni hadithi ya upendo na matumaini. Katika kijiji kidogo cha pwani ya Afrika Mashariki, alikuwa na msichana mdogo anayeitwa Zuri.</p><p>Zuri alipenda kutazama maua yanayokua porini. Aliamini kuwa kila ua lina uzuri wake na hadithi yake. Siku moja, alipata ua la rangi ya samawati ambalo hakuwahi kuliona hapo awali.</p><p>Aliweka nyumbani na kulitunza kila siku. Ua lilikua na kuwa zuri zaidi, na watu wengi walikuja kuuona. Zuri aligundua kuwa kwa kutumaini na kuamini, mambo mazuri yanaweza kutokea.</p>' },
    { title: 'Usafiri wa Ndoto', author: 'Amina Juma', content: '<p>Ali alikuwa mvulana mdogo mwenye ndoto kubwa. Aliota kuwa rubani na kuruka angani. Kila usiku aliangalia ndege zikipita na kufikiria kuwa angani.</p><p>Wazazi wake walimhimiza kusoma kwa bidii. Ali alitumia muda wake kusoma vitabu vya sayansi na teknolojia. Pia alijenga ndege ndogo za mifano nyumbani kwake.</p><p>Miaka ilipita na Ali hakukata tamaa. Hatimaye, alipata nafasi ya kujiunga na chuo cha urubani. Alikuwa mwanafunzi hodari zaidi darasani.</p><p>Leo, Ali ni rubani maarufu anayeruka kote duniani. Hadithi yake inaonyesha kuwa ndoto zinaweza kutimia kwa kufanya kazi kwa bidii na kutokata tamaa.</p>' },
    { title: 'Siri ya Ziwa la Mwezi', author: 'Mwanaisha Hamisi', content: '<p>Ziwa la Mwezi lilikuwa ziwa la ajabu lililozungukwa na hadithi nyingi za kutisha na za kuvutia. Watu waliamini kuwa wakati wa usiku kamili wa mwezi, maji ya ziwa yangeangaza kwa mwanga wa ajabu.</p><p>Mwandishi mchanga aitwaye Juma aliamua kuchunguza siri hiyo. Alichukua kamera na daftari lake na kwenda ziwani usiku wa mwezi kamili.</p><p>Alipofika, aliona mwanga wa kijani ukichomoza kutoka kwenye maji ya kina kirefu. Aliogopa lakini pia alivutiwa. Alichimba katika historia ya ziwa na akagundua kuwa madini ya kipekee yalikuwa chini ya ziwa.</p><p>Ugunduzi wake ulileta watafiti kutoka kote duniani na kijiji chake kikawa maarufu.</p>' },
    { title: 'Paka Mweusi na Jirani Mpya', author: 'Hadithi za Kisasa', content: '<p>Katika mtaa wa mji mkubwa, paka mweusi aliyeitwa Usiku alikuwa akiogopwa na majirani. Watu waliamini kuwa paka mweusi huleta bahati mbaya.</p><p>Lakini Usiku alikuwa paka mkarimu na mpole. Alipenda kukaa karibu na watu na kucheza na watoto. Siku moja, familia mpya ilihamia karibu na alipokuwa akiishi.</p><p>Msichana mdogo, Naima, alipendana na Usiku mara moja. Alimwona si paka wa bahati mbaya bali rafiki mwaminifu. Naima alimwonyesha majirani wengine kuwa Usiku ni paka mzuri.</p><p>Hadithi hii inatufundisha kutowahukumu wengine kwa sura zao na kuwapa kila mtu nafasi ya kuonyesha wema wao.</p>' },
    { title: 'Bahari ya Matumaini', author: 'Mwandishi wa STORIKA', content: '<p>Bahari ya Matumaini ni hadithi ya mwanamke mwenye nguvu anayeitwa Mwanaisha. Aliishi katika kijiji cha wavuvi kando ya bahari kuu.</p><p>Baada ya mumewe kupotea baharini, Mwanaisha aliamua kujifunza uvuvi ili kutunza watoto wake. Wakazi wote walimcheka na kusema wanawake hawawezi kuvua samaki.</p><p>Lakini Mwanaisha hakukata tamaa. Alijenga mashua yake mwenyewe na kujifunza mbinu za uvuvi. Alivua samaki wengi kuliko wavuvi wengine wote kijijini.</p><p>Hadithi yake ilizaa matumaini kwa wanawake wengine pia. Sasa kijiji chake kina wanawake wengi wavuvi na kuna mabadiliko makubwa ya kiuchumi.</p>' }
  ];

  const stories = existing;
  samples.forEach((s, i) => {
    if (!stories.find(st => st.title === s.title)) {
      const id = DB.getNextId() + i;
      const isSeries = i < 2;
      stories.push({
        id: id,
        title: s.title, author: s.author, type: isSeries ? 'series' : 'single', coverImage: '', content: isSeries ? '' : s.content,
        views: Math.floor(Math.random() * 500) + 10,
        createdAt: new Date(Date.now() - i * 86400000).toISOString()
      });
      if (isSeries) {
        DB.setEpisodes(id, [
          { id: DB.getNextId() + i + 100, storyId: id, title: 'Sehemu ya 1', number: 1, content: s.content, createdAt: new Date().toISOString() },
          { id: DB.getNextId() + i + 200, storyId: id, title: 'Sehemu ya 2', number: 2, content: '<p>Mwendelezo wa hadithi hii unakuja hivi karibuni...</p>', createdAt: new Date().toISOString() }
        ]);
      }
    }
  });
  DB.setStories(stories);
  showToast('Hadithi sampuli zimepakwa!', 'success');
  renderDashboard();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  const count = DB.getStories().length;
  if (!confirm('UNA UHAKIKA? Hii itafuta hadithi ZOTE' + (count ? ' (' + count + ' hadithi)' : '') + ' pamoja na maoni!')) return;
  DB.setStories([]);
  const keys = Object.keys(localStorage).filter(k => k.startsWith('storika_comments_'));
  keys.forEach(k => localStorage.removeItem(k));
  showToast('Hadithi zote zimefutwa!', 'success');
  renderDashboard();
});

// ADD NEW EPISODE ROW (in add story form)
document.getElementById('addNewEpisodeRowBtn').addEventListener('click', () => {
  const list = document.getElementById('newEpisodesList');
  const rows = list.querySelectorAll('[data-ep-row]');
  const num = rows.length + 1;
  const div = document.createElement('div');
  div.className = 'episode-item';
  div.dataset.epRow = rows.length;
  div.innerHTML = `<div class="ep-header"><div class="ep-number">${num}</div><input type="text" class="new-ep-title" placeholder="Jina la episode" style="flex:1;margin-left:10px;padding:10px 14px;background:var(--bg-alt);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:inherit;"></div><textarea class="new-ep-content" placeholder="Maudhui ya episode..." style="margin-top:8px;"></textarea>`;
  list.appendChild(div);
});

// ====== MAINTENANCE MODE ======
const maintenanceToggle = document.getElementById('maintenanceToggle');
const maintenanceStatusText = document.getElementById('maintenanceStatusText');
const maintenanceToggleLabel = document.getElementById('maintenanceToggleLabel');
const maintenanceCard = document.getElementById('maintenanceSection');
const viewSiteBtn = document.getElementById('viewSiteBtn');

function updateMaintenanceUI() {
  const isOn = localStorage.getItem('storika_maintenance') === 'true';
  maintenanceToggle.checked = isOn;
  if (isOn) {
    maintenanceStatusText.textContent = 'Tovuti iko kwenye matengenezo - watumiaji hawawezi kufikia chochote';
    maintenanceToggleLabel.textContent = 'Zima Matengenezo';
    maintenanceCard.classList.add('maintenance-on');
    viewSiteBtn.style.display = 'inline-flex';
  } else {
    maintenanceStatusText.textContent = 'Tovuti inafanya kazi kwa kawaida';
    maintenanceToggleLabel.textContent = 'Washa Matengenezo';
    maintenanceCard.classList.remove('maintenance-on');
    viewSiteBtn.style.display = 'none';
  }
}

maintenanceToggle.addEventListener('change', () => {
  const isOn = maintenanceToggle.checked;
  localStorage.setItem('storika_maintenance', isOn ? 'true' : 'false');
  updateMaintenanceUI();
  showToast(isOn ? 'Tovuti iko sasa kwenye matengenezo' : 'Matengenezo yamezimwa, tovuti inafanya kazi', 'success');
});

// ====== NOTIFICATIONS ======
let lastNotifCheck = parseInt(localStorage.getItem('storika_notif_last_check') || '0');
let notifCount = parseInt(localStorage.getItem('storika_notif_count') || '0');
const notifBadge = document.getElementById('notifBadge');
const notifPanel = document.getElementById('notifPanel');
const notifBody = document.getElementById('notifBody');
const notifList = document.getElementById('notifList');
const notifEmpty = document.getElementById('notifEmpty');
const notifToast = document.getElementById('notifToast');
const notifToastTitle = document.getElementById('notifToastTitle');
const notifToastDesc = document.getElementById('notifToastDesc');

function showNotifToast(title, desc) {
  notifToastTitle.textContent = title;
  notifToastDesc.textContent = desc;
  notifToast.classList.add('show');
  clearTimeout(notifToast._t);
  notifToast._t = setTimeout(() => notifToast.classList.remove('show'), 5000);
}

function updateNotifBadge() {
  notifBadge.textContent = notifCount;
  notifBadge.style.display = notifCount > 0 ? 'inline' : 'none';
}

function renderNotifPanel() {
  const raw = localStorage.getItem('storika_notifications');
  const notifications = raw ? JSON.parse(raw) : [];
  notifList.innerHTML = notifications.length
    ? notifications.map(n => `
      <div class="notif-item">
        <div class="notif-dot"></div>
        <div class="notif-content">
          <p class="notif-title">${n.title}</p>
          <p class="notif-desc">${n.desc}</p>
          <p class="notif-time">${new Date(n.time).toLocaleString('sw-TZ')}</p>
        </div>
      </div>`).join('')
    : '';
  notifEmpty.style.display = notifications.length ? 'none' : 'block';
}

function addNotification(title, desc) {
  const raw = localStorage.getItem('storika_notifications');
  const notifications = raw ? JSON.parse(raw) : [];
  notifications.unshift({ id: Date.now(), title, desc, time: Date.now() });
  if (notifications.length > 50) notifications.length = 50;
  localStorage.setItem('storika_notifications', JSON.stringify(notifications));
  notifCount++;
  localStorage.setItem('storika_notif_count', String(notifCount));
  updateNotifBadge();
  renderNotifPanel();
  showNotifToast(title, desc);
}

function checkNewNotifications() {
  const commentData = localStorage.getItem('storika_notify_comment');
  if (commentData) {
    try {
      const data = JSON.parse(commentData);
      if (data.time > lastNotifCheck) {
        addNotification('Maoni Mapya', `${data.name} aliandika maoni kwenye "${data.storyTitle || 'hadithi'}": "${data.comment.substring(0, 50)}${data.comment.length > 50 ? '...' : ''}"`);
      }
    } catch(e) {}
    localStorage.removeItem('storika_notify_comment');
  }

  lastNotifCheck = Date.now();
  localStorage.setItem('storika_notif_last_check', String(lastNotifCheck));
}

document.getElementById('notifSidebarBtn').addEventListener('click', (e) => {
  e.preventDefault();
  notifPanel.classList.toggle('open');
});

document.getElementById('closeNotifBtn').addEventListener('click', () => {
  notifPanel.classList.remove('open');
});

renderNotifPanel();
updateNotifBadge();
setInterval(checkNewNotifications, 3000);

// ====== INIT ======
checkAuth();
