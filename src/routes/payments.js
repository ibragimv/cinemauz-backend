const express = require('express');
const router = express.Router();
const bot = require('../telegram/bot');
const authService = require('../services/auth.service');
const config = require('../config');

/**
 * CinemaUZ To'lov Tizimi (Yangi Balans Mantiqi)
 * 1. Foydalanuvchi balansini to'ldiradi (Telegram Invoice).
 * 2. Balansdan tarif sotib oladi.
 */

// POST /api/payments/create-invoice - Balansni to'ldirish uchun Invoice yaratish
router.post('/create-invoice', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!amount || amount < 1000) {
        return res.status(400).json({ success: false, error: "Minimal summa 1000 so'm" });
    }

    console.log(`💰 [Payment] Invoice yaratilmoqda: Summa=${amount}, User=${userId}`);

    const invoiceLink = await bot.createInvoiceLink(
      "Balansni to'ldirish",
      `CinemaUZ balansingizga ${amount.toLocaleString()} so'm qo'shish`,
      JSON.stringify({ userId, amount, type: 'deposit' }), // payload
      config.CLICK_PROVIDER_TOKEN,
      "UZS",
      [{ label: "Balansni to'ldirish", amount: amount * 100 }] // Telegram tiyinlarda hisoblaydi
    );

    res.json({ success: true, invoiceLink });
  } catch (err) {
    console.error('❌ [Payment] Invoice error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/buy-plan - Balansdan tarif sotib olish
router.post('/buy-plan', async (req, res) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId) {
        return res.status(400).json({ success: false, error: "Ma'lumotlar yetarli emas" });
    }
    
    const user = await authService.buyPlan(userId, planId);
    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ [Payment] BuyPlan error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * CLICK MERCHANT API CALLBACKS
 * 1. Prepare - Check if user exists
 * 2. Complete - Success payment
 */
const crypto = require('crypto');

router.post('/click/prepare', async (req, res) => {
  const {
    click_trans_id, service_id, click_paydoc_id,
    merchant_trans_id, amount, action, error,
    error_note, sign_time, sign_string
  } = req.body;

  console.log('💳 [Click] Prepare Request:', req.body);

  const mySign = crypto.createHash('md5').update(
    `${click_trans_id}${service_id}${config.CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`
  ).digest('hex');

  if (mySign !== sign_string) {
    return res.json({ error: -1, error_note: "Sign string mismatch" });
  }

  try {
    const user = await authService.getUsersList().find(u => u.id === merchant_trans_id);
    if (!user) {
        return res.json({ error: -5, error_note: "User not found" });
    }

    res.json({
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: merchant_trans_id,
      error: 0,
      error_note: "Success"
    });
  } catch (err) {
    res.json({ error: -7, error_note: "Internal error" });
  }
});

router.post('/click/complete', async (req, res) => {
  const {
    click_trans_id, service_id, click_paydoc_id,
    merchant_trans_id, merchant_prepare_id,
    amount, action, error,
    error_note, sign_time, sign_string
  } = req.body;

  console.log('✅ [Click] Complete Request:', req.body);

  const mySign = crypto.createHash('md5').update(
    `${click_trans_id}${service_id}${config.CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`
  ).digest('hex');

  if (mySign !== sign_string) {
    return res.json({ error: -1, error_note: "Sign string mismatch" });
  }

  if (parseInt(error) < 0) {
    return res.json({ error, error_note });
  }

  try {
    // Balansni to'ldirish
    await authService.addBalance(null, parseFloat(amount), merchant_trans_id);
    
    res.json({
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: merchant_trans_id,
      error: 0,
      error_note: "Success"
    });
  } catch (err) {
    res.json({ error: -7, error_note: "Internal error" });
  }
});

module.exports = router;
