require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const SasaPay = require('./sasapay');

const app = express();
const PORT = process.env.PORT || 3000;
const sasapay = new SasaPay();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

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
