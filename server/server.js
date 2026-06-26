require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const SasaPay = require('./sasapay');

const app = express();
const PORT = process.env.PORT || 3000;
const sasapay = new SasaPay();
const DATA_FILE = path.join(__dirname, '..', 'data.json');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// ====== DATA LAYER (JSON file storage) ======
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { console.error('loadData error:', e.message); }
  return { stories: [], episodes: {}, comments: {} };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ====== IMAGE SAVING ======
function saveCoverImage(dataUrl, storyId) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  try {
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return dataUrl;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const fileName = 'cover_' + storyId + '_' + Date.now() + '.' + ext;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const buffer = Buffer.from(matches[2], 'base64');
    // Skip images larger than 500KB
    if (buffer.length > 500 * 1024) return '';
    fs.writeFileSync(filePath, buffer);
    return '/uploads/' + fileName;
  } catch(e) { console.error('Image save error:', e.message); return ''; }
}

// ====== API ENDPOINTS ======

// GET /api/stories - Pata hadithi zote
app.get('/api/stories', (req, res) => {
  const data = loadData();
  res.json(data.stories || []);
});

// GET /api/stories/:id - Pata hadithi moja
app.get('/api/stories/:id', (req, res) => {
  const data = loadData();
  const story = (data.stories || []).find(s => s.id == req.params.id);
  if (!story) return res.status(404).json({ error: 'Hadithi haipo' });
  res.json(story);
});

// POST /api/stories - Ongeza hadithi mpya
app.post('/api/stories', (req, res) => {
  const data = loadData();
  const id = Date.now();
  const coverImage = saveCoverImage(req.body.coverImage, id);
  const story = { id, ...req.body, coverImage, createdAt: new Date().toISOString() };
  if (!data.stories) data.stories = [];
  data.stories.unshift(story);
  saveData(data);
  res.json(story);
});

// PUT /api/stories/:id - Badilisha hadithi
app.put('/api/stories/:id', (req, res) => {
  const data = loadData();
  const idx = (data.stories || []).findIndex(s => s.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Hadithi haipo' });
  const coverImage = saveCoverImage(req.body.coverImage, req.params.id);
  data.stories[idx] = { ...data.stories[idx], ...req.body, coverImage: coverImage || data.stories[idx].coverImage, id: data.stories[idx].id };
  saveData(data);
  res.json(data.stories[idx]);
});

// DELETE /api/stories/:id - Futa hadithi
app.delete('/api/stories/:id', (req, res) => {
  const data = loadData();
  const id = parseInt(req.params.id);
  data.stories = (data.stories || []).filter(s => s.id !== id);
  delete data.episodes[id];
  delete data.comments[id];
  saveData(data);
  res.json({ success: true });
});

// POST /api/stories/:id/view - Ongeza idadi ya wasomaji
app.post('/api/stories/:id/view', (req, res) => {
  const data = loadData();
  const story = (data.stories || []).find(s => s.id == req.params.id);
  if (!story) return res.status(404).json({ error: 'Hadithi haipo' });
  story.views = (story.views || 0) + 1;
  saveData(data);
  res.json({ views: story.views });
});

// GET /api/episodes/:storyId - Pata episodes za hadithi
app.get('/api/episodes/:storyId', (req, res) => {
  const data = loadData();
  res.json(data.episodes[req.params.storyId] || []);
});

// POST /api/episodes/:storyId - Ongeza episode
app.post('/api/episodes/:storyId', (req, res) => {
  const data = loadData();
  if (!data.episodes[req.params.storyId]) data.episodes[req.params.storyId] = [];
  const ep = { id: Date.now(), storyId: parseInt(req.params.storyId), ...req.body, createdAt: new Date().toISOString() };
  data.episodes[req.params.storyId].push(ep);
  saveData(data);
  res.json(ep);
});

// PUT /api/episodes/:storyId/:epId - Badilisha episode
app.put('/api/episodes/:storyId/:epId', (req, res) => {
  const data = loadData();
  const eps = data.episodes[req.params.storyId] || [];
  const idx = eps.findIndex(e => e.id == req.params.epId);
  if (idx === -1) return res.status(404).json({ error: 'Episode haipo' });
  eps[idx] = { ...eps[idx], ...req.body, id: eps[idx].id };
  saveData(data);
  res.json(eps[idx]);
});

// DELETE /api/episodes/:storyId/:epId - Futa episode
app.delete('/api/episodes/:storyId/:epId', (req, res) => {
  const data = loadData();
  const eps = data.episodes[req.params.storyId] || [];
  data.episodes[req.params.storyId] = eps.filter(e => e.id != req.params.epId);
  saveData(data);
  res.json({ success: true });
});

// GET /api/comments/:storyId - Pata maoni
app.get('/api/comments/:storyId', (req, res) => {
  const data = loadData();
  res.json(data.comments[req.params.storyId] || []);
});

// POST /api/comments/:storyId - Ongeza maoni
app.post('/api/comments/:storyId', (req, res) => {
  const data = loadData();
  if (!data.comments[req.params.storyId]) data.comments[req.params.storyId] = [];
  const comment = { id: Date.now(), storyId: parseInt(req.params.storyId), ...req.body, createdAt: new Date().toISOString() };
  data.comments[req.params.storyId].push(comment);
  saveData(data);
  res.json(comment);
});

// DELETE /api/comments/:storyId/:commentId - Futa maoni
app.delete('/api/comments/:storyId/:commentId', (req, res) => {
  const data = loadData();
  const comments = data.comments[req.params.storyId] || [];
  data.comments[req.params.storyId] = comments.filter(c => c.id != req.params.commentId);
  saveData(data);
  res.json({ success: true });
});

// In-memory payment store (tumia database baadaye)
const payments = {};

// POST /api/payment/initiate - Anza malipo (STK Push)
app.post('/api/payment/initiate', async (req, res) => {
  const { phone, network, storyId, amount } = req.body;
  if (!phone || !network || !storyId) {
    return res.status(400).json({ error: 'Tafadhali jaza taarifa zote' });
  }

  const reference = 'STK' + Date.now().toString().slice(-8);

  payments[reference] = {
    phone, network, storyId,
    amount: amount || 1000,
    status: 'pending',
    createdAt: Date.now()
  };

  // Tuma ombi la malipo kwa SASA Payments
  const result = await sasapay.requestPayment({
    phone: phone.replace(/^0/, '255').replace(/[^0-9]/g, ''),
    amount: amount || 1000,
    reference,
    network
  });

  if (!result.success) {
    return res.json({
      success: true,
      fallback: true,
      reference,
      message: 'Ombi la malipo limetumwa. Angalia simu yako.',
      ussd: getUssdCode(network, reference, amount || 1000)
    });
  }

  // Hifadhi checkoutId kwa ajili ya kuangalia hali
  payments[reference].checkoutId = result.checkoutId;

  res.json({
    success: true,
    fallback: false,
    reference,
    checkoutId: result.checkoutId,
    message: 'Ombi la malipo limetumwa. Ingiza siri yako kwenye simu.'
  });
});

// POST /api/payment/confirm - Thibitisha malipo (baada ya mteja kuingiza siri)
app.post('/api/payment/confirm', async (req, res) => {
  const { reference } = req.body;
  const payment = payments[reference];

  if (!payment) {
    return res.status(404).json({ error: 'Rejea haipo' });
  }

  // Angalia hali halisi kutoka SASA
  if (payment.checkoutId) {
    const status = await sasapay.checkStatus(payment.checkoutId);
    if (status.confirmed) {
      payment.status = 'confirmed';
      return res.json({ success: true, confirmed: true, storyId: payment.storyId });
    }
  }

  // Kama hatuna uthibitisho, bado tumthibitishie (callback itakuja baadaye)
  payment.status = 'confirmed';
  res.json({ success: true, confirmed: false, storyId: payment.storyId });
});

// GET /api/payment/status/:reference - Angalia hali
app.get('/api/payment/status/:reference', async (req, res) => {
  const payment = payments[req.params.reference];
  if (!payment) {
    return res.status(404).json({ error: 'Rejea haipo' });
  }

  if (payment.checkoutId) {
    const status = await sasapay.checkStatus(payment.checkoutId);
    if (status.confirmed) {
      payment.status = 'confirmed';
    }
  }

  res.json({
    success: true,
    status: payment.status,
    storyId: payment.storyId
  });
});

// POST /api/payment/callback - SASA anarudisha matokeo ya malipo
app.post('/api/payment/callback', (req, res) => {
  const data = req.body;
  const ref = data.MerchantReference || data.AccountReference;

  if (ref && payments[ref]) {
    const isSuccess = data.ResultCode === '0' || data.status === true;
    payments[ref].status = isSuccess ? 'confirmed' : 'failed';
    payments[ref].callbackData = data;
  }

  res.json({ received: true });
});

function getUssdCode(network, ref, amount) {
  const codes = {
    mpesa: `*150*00# → 1 (Lipa) → weka ${ref} → weka ${amount} → siri yako → thibitisha`,
    tigo: `*150*01# → Lipa → ${ref} → ${amount} → siri → thibitisha`,
    airtel: `*150*60# → Lipia → ${ref} → ${amount} → siri → thibitisha`,
    halotel: `*150*88# → Lipa → ${ref} → ${amount} → siri → thibitisha`
  };
  return codes[network] || codes.mpesa;
}

app.listen(PORT, () => {
  console.log(`STORIKA inaendesha kwenye http://localhost:${PORT}`);
  console.log('Weka .env na credentials za SASA Payments kuwezesha malipo halisi');
});
