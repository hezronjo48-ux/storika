// SASA Payments API Integration for Tanzania Mobile Money
// Inasaidia: M-Pesa, Tigo Pesa, Airtel Money, Halopesa
// Jisajili: https://sasapay.co.tz/business.html (Individual Registration)

const axios = require('axios');

class SasaPay {
  constructor() {
    this.clientId = process.env.SASAPAY_CLIENT_ID;
    this.clientSecret = process.env.SASAPAY_CLIENT_SECRET;
    this.merchantCode = process.env.SASAPAY_MERCHANT_CODE;
    this.env = process.env.SASAPAY_ENV || 'sandbox';

    this.baseURL = this.env === 'production'
      ? 'https://api.sasapay.co.tz'
      : 'https://sandbox.sasapay.co.tz';

    this.token = null;
    this.tokenExpiry = 0;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    try {
      const res = await axios.post(`${this.baseURL}/oauth/v1/generate`, null, {
        params: { grant_type: 'client_credentials' },
        auth: { username: this.clientId, password: this.clientSecret }
      });
      this.token = res.data.access_token;
      this.tokenExpiry = Date.now() + (res.data.expires_in || 3600) * 1000 - 60000;
      return this.token;
    } catch (err) {
      throw new Error('SASA token error: ' + (err.response?.data?.message || err.message));
    }
  }

  // Network codes za Tanzania
  static networkCodes = {
    mpesa: '63902',
    tigo: '63903',
    airtel: '63904',
    halotel: '63905'
  };

  // Tuma STK Push kwa mteja
  async requestPayment({ phone, amount, reference, network }) {
    const token = await this.getToken();
    const networkCode = SasaPay.networkCodes[network] || '63902';

    try {
      const res = await axios.post(`${this.baseURL}/payments/request-payment/`, {
        MerchantCode: this.merchantCode,
        NetworkCode: networkCode,
        Currency: 'TZS',
        Amount: amount.toString(),
        PhoneNumber: phone,
        AccountReference: reference,
        TransactionDesc: 'STORIKA - Kununua hadithi',
        CallBackURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payment/callback`
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        checkoutId: res.data.CheckoutRequestID || res.data.checkout_id,
        message: res.data.detail || 'Ombi la malipo limetumwa',
        raw: res.data
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'SASA API error';
      return { success: false, error: msg };
    }
  }

  // Angalia hali ya malipo
  async checkStatus(checkoutId) {
    const token = await this.getToken();
    try {
      const res = await axios.post(`${this.baseURL}/payments/transaction-status/`, {
        merchantCode: this.merchantCode,
        checkoutRequestId: checkoutId
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = res.data;
      const isSuccess = data.ResultCode === '0' || data.status === true;
      return { success: true, confirmed: isSuccess, data };
    } catch (err) {
      return { success: false, confirmed: false, error: err.message };
    }
  }
}

module.exports = SasaPay;
