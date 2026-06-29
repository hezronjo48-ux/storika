const API_BASE = 'api.php';

async function api(action, data = {}) {
  const url = API_BASE + '?action=' + action;
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  opts.body = JSON.stringify(data);
  const r = await fetch(url, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({ error: r.statusText })); throw new Error(e.error || 'Request failed'); }
  return r.json();
}

const API = {
  async getStories() { const r = await api('list-stories'); return Array.isArray(r) ? r : []; },
  async getStory(id) { return api('get-story', { id }); },
  async addView(id) { return api('increment-view', { id }); },
  async getEpisodes(storyId) { const r = await api('list-episodes', { story_id: storyId }); return Array.isArray(r) ? r : []; },
  async getComments(storyId) { const r = await api('list-comments', { story_id: storyId }); return Array.isArray(r) ? r : []; },
  async addComment(storyId, comment) { return api('save-comment', { story_id: storyId, ...comment }); },
  async checkMaintenance() { return api('get-settings'); }
};

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ====== MAINTENANCE MODE CHECK ======
(async function checkMaintenance() {
  const overlay = document.getElementById('maintenanceOverlay');
  if (!overlay) return;
  const bypass = new URLSearchParams(window.location.search).get('maintenance_bypass');
  if (bypass === '1') { overlay.style.display = 'none'; return; }
  try {
    const r = await API.checkMaintenance();
    const settings = Array.isArray(r) ? r : [];
    const maintenance = settings.find(s => s.setting_key === 'maintenance_mode');
    overlay.style.display = (maintenance && maintenance.setting_value === 'true') ? 'flex' : 'none';
  } catch(_) { overlay.style.display = 'none'; }
})();

(function initTheme() {
  const saved = localStorage.getItem('storika-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = saved === 'dark' ? '&#9790;' : '&#9728;';
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('storika-theme', next);
      btn.innerHTML = next === 'dark' ? '&#9790;' : '&#9728;';
    });
  }
})();

async function navigate(hash) {
  const route = hash.replace('#', '') || '/';
  const parts = route.split('/').filter(Boolean);
  const navLinks = document.querySelectorAll('.nav a');
  navLinks.forEach(a => a.classList.remove('active'));

  if (route === '/') {
    await renderHome();
    navLinks.forEach(a => { if (a.dataset.nav === '/') a.classList.add('active'); });
  } else if (parts[0] === 'story') {
    await renderStory(parseInt(parts[1]));
  } else {
    await renderHome();
    navLinks.forEach(a => { if (a.dataset.nav === '/') a.classList.add('active'); });
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('active');
  navigate(window.location.hash);
});
window.addEventListener('DOMContentLoaded', () => navigate(window.location.hash || '#/'));

function getMain() { return document.getElementById('mainContent'); }
function setTitle(t) { document.title = 'STORIKA' + (t ? ' - ' + t : ''); }

var _defCover = null;
function defCover() {
  if (!_defCover) _defCover = getDefaultCover();
  return _defCover;
}
function isMpya(s) {
  if (!s.createdAt) return false;
  const days = (Date.now() - new Date(s.createdAt).getTime()) / 86400000;
  return days < 7;
}
function storyCardHTML(s) {
  const text = s.content ? s.content.replace(/<[^>]*>/g, '').substring(0, 70) : '';
  let badges = '';
  if (isMpya(s)) badges += '<span class="badge-new">Mpya</span>';
  if (s.type === 'series') badges += '<span class="badge-series">Mfululizo</span>';
  return `<div class="story-card-modern" data-read="${s.id}">
    <div class="card-badge">${badges}</div>
    <div class="card-cover-wrapper">
      <img class="card-cover" src="${s.coverImage || defCover()}" alt="${escHtml(s.title)}" loading="lazy">
    </div>
    <div class="card-body">
      <h3 class="card-title">${escHtml(s.title)}</h3>
      <p class="card-desc">${escHtml(text)}</p>
      <div class="card-foot">
        <span class="card-author">na <strong>${escHtml(s.author || 'Mwandishi wa STORIKA')}</strong></span>
        <span class="card-views">&#128065; ${s.views || 0}</span>
      </div>
    </div>
  </div>`;
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function getDefaultCover() {
  return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect width=%22400%22 height=%22200%22 fill=%22%230A2342%22/%3E%3Ctext x=%22200%22 y=%22110%22 font-family=%22sans-serif%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22%23D4AF37%22%3E📖%3C/text%3E%3C/svg%3E';
}

async function loadStories() {
  return await API.getStories();
}

async function renderHome() {
  setTitle('Nyumbani');
  const stories = await loadStories();

  const mc = getMain();
  mc.innerHTML = `
    <div class="container" style="padding-top:32px;" id="stories">
      <div class="section-modern">
        <div class="section-head">
          <h2><span class="sec-icon">&#128218;</span>Hadithi</h2>
          <span class="section-count">${stories.length} hadithi</span>
        </div>
        ${stories.length
          ? `<div class="story-grid-modern">${stories.sort((a,b) => b.id - a.id).map(storyCardHTML).join('')}</div>`
          : `<div class="empty-modern"><div class="empty-icon">&#128214;</div><h3>Hakuna hadithi bado</h3><p>Bonyeza kitufe cha Admin kuongeza hadithi.</p></div>`}
      </div>
    </div>`;
}

async function getEpisodes(storyId) {
  return await API.getEpisodes(storyId);
}

async function renderStory(id) {
  let stories = await loadStories();
  let story = stories.find(s => s.id === id);
  if (!story) { navigate('#/'); return; }
  setTitle(story.title);

  const v = await API.addView(id);
  story.views = v.views;

  const comments = await API.getComments(id);
  const cover = story.coverImage || getDefaultCover();
  const episodes = story.type === 'series' ? await getEpisodes(id) : [];

  stories = await loadStories();
  const idx = stories.findIndex(s => s.id === id);
  const prevStory = idx > 0 ? stories[idx - 1] : null;
  const nextStory = idx < stories.length - 1 ? stories[idx + 1] : null;

  let contentHtml = '';
  if (story.type === 'series' && episodes.length > 0) {
    contentHtml = `<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--text);">Episodes (${episodes.length})</h3>
      ${episodes.map(ep => `
        <div class="episode-modern">
          <div class="ep-head" data-ep-target="${ep.id}">
            <div class="ep-left">
              <div class="ep-num">${ep.number}</div>
              <span>${escHtml(ep.title)}</span>
            </div>
            <span class="ep-arrow">&#9660;</span>
          </div>
          <div class="ep-body" id="epContent_${ep.id}">${ep.content || '<p style="color:var(--text-light);">Maudhui ya episode yanaandaliwa...</p>'}</div>
        </div>`).join('')}`;
  } else {
    contentHtml = `<div class="story-content">${story.content || '<p style="color:var(--text-light);text-align:center;">Maudhui ya hadithi yanaandaliwa...</p>'}</div>`;
  }

  const mc = getMain();
  mc.innerHTML = `
    <div class="detail-modern">
      <div class="detail-header">
        <div class="dh-inner">
          <img class="dh-cover" src="${cover}" alt="${escHtml(story.title)}">
          <div class="dh-info">
            <h1>${escHtml(story.title)}</h1>
            <div class="dh-meta">
              <span>&#128100; ${escHtml(story.author || 'Mwandishi wa STORIKA')}</span>
              <span>&#128065; ${story.views} wasomaji</span>
              ${story.type === 'series' ? '<span class="dh-type">Mfululizo</span>' : ''}
            </div>
            <p style="opacity:0.7;font-size:14px;line-height:1.7;">${story.content ? story.content.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''}</p>
          </div>
        </div>
      </div>
      <div class="detail-body">
        ${contentHtml}
      </div>
      <div class="chapter-nav-modern">
        ${prevStory ? `<a href="#/story/${prevStory.id}" class="btn-chapter-modern">&#8592; Sura Iliyopita</a>` : '<span class="btn-chapter-modern disabled">&#8592; Sura Iliyopita</span>'}
        ${nextStory ? `<a href="#/story/${nextStory.id}" class="btn-chapter-modern">Sura Inayofuata &#8594;</a>` : '<span class="btn-chapter-modern disabled">Sura Inayofuata &#8594;</span>'}
      </div>
      <div class="comments-modern">
        <div class="cm-title">Maoni <span class="cm-count">${comments.length}</span></div>
        <div class="cm-form">
          <form id="commentForm">
            <div class="cm-input-row">
              <input type="text" id="commentName" placeholder="Jina lako (si lazima)" autocomplete="name">
            </div>
            <textarea id="commentText" placeholder="Andika maoni yako..." required></textarea>
            <button type="submit" class="btn-submit">Tuma Maoni</button>
          </form>
        </div>
        <div class="cm-list" id="commentsList">${comments.length ? comments.map(c => `
          <div class="cm-item">
            <div class="cm-author">
              <div class="cm-avatar">${escHtml(c.name.charAt(0).toUpperCase())}</div>
              <div>
                <div class="cm-name">${escHtml(c.name)}</div>
                <div class="cm-date">${new Date(c.createdAt).toLocaleDateString('sw-TZ')}</div>
              </div>
            </div>
            <div class="cm-text">${escHtml(c.comment)}</div>
          </div>`).join('') : '<p style="color:var(--text-light);text-align:center;padding:20px;">Hakuna maoni bado. Kuwa wa kwanza kutoa maoni!</p>'}
        </div>
      </div>
    </div>`;

  document.querySelectorAll('.ep-head').forEach(h => {
    h.addEventListener('click', () => {
      const id = h.dataset.epTarget;
      const body = document.getElementById('epContent_' + id);
      const arrow = h.querySelector('.ep-arrow');
      if (!body.style.display || body.style.display === 'none') {
        body.style.display = 'block';
        arrow.classList.add('open');
      } else {
        body.style.display = 'none';
        arrow.classList.remove('open');
      }
  });
});

// Dynamic copyright year
const yearEl = document.getElementById('copyrightYear');
if (yearEl) yearEl.textContent = new Date().getFullYear();

  document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('commentName').value.trim() || 'Msomaji';
    const text = document.getElementById('commentText').value.trim();
    if (!text) return;
    await API.addComment(id, { author: name, content: text });
    const comments = await API.getComments(id);
    document.getElementById('commentText').value = '';
    const list = document.getElementById('commentsList');
    list.innerHTML = comments.map(c => `
      <div class="cm-item">
        <div class="cm-author">
          <div class="cm-avatar">${escHtml((c.author||'M').charAt(0).toUpperCase())}</div>
          <div>
            <div class="cm-name">${escHtml(c.author||'Msomaji')}</div>
            <div class="cm-date">${new Date(c.createdAt).toLocaleDateString('sw-TZ')}</div>
          </div>
        </div>
        <div class="cm-text">${escHtml(c.content)}</div>
      </div>`).join('');
    showToast('Maoni yametumwa!', 'success');
    localStorage.setItem('storika_notify_comment', JSON.stringify({ name, comment: text, storyId: id, storyTitle: story.title, time: Date.now() }));
  });
}

// ====== SEARCH ======
(function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(input._debounce);
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); results.innerHTML = ''; return; }
    input._debounce = setTimeout(async () => {
      const allStories = await API.getStories();
      const stories = (Array.isArray(allStories) ? allStories : []).filter(s => s.title.toLowerCase().includes(q)).slice(0, 6);
      if (!stories.length) {
        results.innerHTML = '<div style="padding:16px;color:var(--text-light);text-align:center;">Hakuna hadithi zilizopatikana</div>';
        results.classList.add('active'); return;
      }
      results.innerHTML = stories.map(s => {
        return `<a href="#/story/${s.id}" class="search-result-item" data-search-read="${s.id}"><img src="${s.coverImage || defCover()}" alt="${escHtml(s.title)}"><div class="info"><h4>${escHtml(s.title)}</h4><span>${s.views||0} wasomaji</span></div></a>`;
      }).join('');
      results.classList.add('active');

      document.querySelectorAll('[data-search-read]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          results.classList.remove('active');
          input.value = '';
          _pendingStoryId = parseInt(el.dataset.searchRead);
          document.getElementById('payStep1').style.display = 'block';
          document.getElementById('payStep2').style.display = 'none';
          document.getElementById('phoneInput').value = '';
          document.getElementById('payError').style.display = 'none';
          document.querySelectorAll('.pay-network-btn').forEach(b => b.classList.remove('active'));
          document.querySelector('.pay-network-btn[data-network="mpesa"]').classList.add('active');
          _currentNetwork = 'mpesa';
          document.getElementById('paymentModal').classList.add('active');
        });
      });
    }, 300);
  });

  document.addEventListener('click', (e) => { if (!e.target.closest('.search-bar')) { results.classList.remove('active'); } });
})();

// ====== PAYMENT ======
var _pendingStoryId = null;
var _currentNetwork = 'mpesa';
var _payTimer = null;

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-read]');
  if (!btn) return;
  e.preventDefault();
  _pendingStoryId = parseInt(btn.dataset.read);
  document.getElementById('payStep1').style.display = 'block';
  document.getElementById('payStep2').style.display = 'none';
  document.getElementById('phoneInput').value = '';
  document.getElementById('payError').style.display = 'none';
  document.querySelectorAll('.pay-network-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pay-network-btn[data-network="mpesa"]').classList.add('active');
  _currentNetwork = 'mpesa';
  document.getElementById('paymentModal').classList.add('active');
});

document.querySelectorAll('.pay-network-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pay-network-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _currentNetwork = btn.dataset.network;
  });
});

document.getElementById('cancelPayBtn').addEventListener('click', () => {
  document.getElementById('paymentModal').classList.remove('active');
  _pendingStoryId = null;
});
document.getElementById('paymentModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) { document.getElementById('paymentModal').classList.remove('active'); _pendingStoryId = null; }
});

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('phoneInput').value.trim();
  const error = document.getElementById('payError');

  if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
    error.textContent = 'Tafadhali weka namba sahihi ya simu (0712 345 678)';
    error.style.display = 'block';
    return;
  }
  error.style.display = 'none';

  const fullPhone = '+255' + phone.replace(/[^0-9]/g, '');

  document.getElementById('payStep1').style.display = 'none';
  document.getElementById('payStep2').style.display = 'block';
  document.getElementById('payPhoneDisplay').textContent = fullPhone;
  document.getElementById('payWaiting').style.display = 'block';
  document.getElementById('paySuccessBtn').style.display = 'none';
  document.getElementById('payFailBtn').style.display = 'none';
  document.getElementById('payTimerNum').textContent = '30';
  document.querySelectorAll('.p-dot').forEach((d, i) => {
    d.className = 'p-dot' + (i === 0 ? ' done' : i === 1 ? ' active' : '');
  });

  let usingRealAPI = false;
  try {
    const resp = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone.replace(/[^0-9]/g, ''),
        network: _currentNetwork,
        storyId: _pendingStoryId,
        amount: 1000
      })
    });
    if (resp.ok) { usingRealAPI = true; }
  } catch (_) {}

  if (usingRealAPI) {
    document.getElementById('payWaiting').textContent = 'Ombi la malipo limetumwa. Angalia simu yako kisha ingiza siri yako.';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try { await fetch('/api/payment/status/' + Date.now()); } catch(_) {}
    }
    document.getElementById('payWaiting').style.display = 'none';
    document.getElementById('paySuccessBtn').style.display = 'block';
    return;
  }

  let sec = 30;
  let _payResolved = false;
  document.getElementById('payTimerNum').textContent = sec;
  clearInterval(_payTimer);
  _payTimer = setInterval(() => {
    sec--;
    document.getElementById('payTimerNum').textContent = sec;
    if (sec <= 10 && sec > 0) {
      document.getElementById('payTimer').style.color = '#dc3545';
    }
    if (sec <= 0 && !_payResolved) {
      _payResolved = true;
      clearInterval(_payTimer);
      document.getElementById('payTimer').style.color = '';
      document.getElementById('payTimerNum').textContent = '0';
      document.getElementById('payWaiting').style.display = 'none';
      document.getElementById('payFailBtn').style.display = 'block';
      document.getElementById('paySuccessBtn').style.display = 'none';
      return;
    }
  }, 1000);

  setTimeout(() => {
    if (_payResolved) return;
    _payResolved = true;
    clearInterval(_payTimer);
    document.getElementById('payTimer').style.color = '';
    document.getElementById('payTimerNum').textContent = '0';
    document.getElementById('payWaiting').style.display = 'none';
    document.getElementById('paySuccessBtn').style.display = 'block';
    document.getElementById('payFailBtn').style.display = 'none';
  }, 8000);
});

document.getElementById('paySuccessBtn').addEventListener('click', async () => {
  clearInterval(_payTimer);
  document.getElementById('paymentModal').classList.remove('active');
  try { await fetch('/api/payment/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: 'STK' + Date.now().toString().slice(-8) }) }); } catch(_) {}
  if (_pendingStoryId) {
    const id = _pendingStoryId;
    _pendingStoryId = null;
    window.location.hash = '#/story/' + id;
  }
});

document.getElementById('payFailBtn').addEventListener('click', () => {
  clearInterval(_payTimer);
  document.getElementById('payTimer').style.color = '';
  document.getElementById('payStep1').style.display = 'block';
  document.getElementById('payStep2').style.display = 'none';
});

document.getElementById('payBackBtn').addEventListener('click', () => {
  clearInterval(_payTimer);
  document.getElementById('payTimer').style.color = '';
  document.getElementById('payStep1').style.display = 'block';
  document.getElementById('payStep2').style.display = 'none';
});

// ====== NOTIFICATIONS (PUBLIC) ======
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

(function checkNewStories() {
  const data = localStorage.getItem('storika_notify_story');
  if (data) {
    try {
      const s = JSON.parse(data);
      showNotifToast('Hadithi Mpya Imeongezwa', s.title);
    } catch(e) {}
    localStorage.removeItem('storika_notify_story');
  }
})();

// ====== READING PROGRESS BAR ======
const progressBar = document.getElementById('readingProgress');
let _scrollRaf = null;
window.addEventListener('scroll', () => {
  if (_scrollRaf) return;
  _scrollRaf = requestAnimationFrame(() => {
    _scrollRaf = null;
    if (!progressBar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
    progressBar.style.width = pct + '%';
  });
});


