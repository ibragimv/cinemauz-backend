const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { protect } = require('../middlewares/auth.middleware');

const getReqInfo = (req) => ({
  ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  userAgent: req.headers['user-agent']
});

// 1. Check User Status (Existing? Has PIN?)
router.post('/check-status', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.checkUserStatus(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.sendOTP(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await authService.verifyOTP(email, code, getReqInfo(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Verify PIN
router.post('/verify-pin', async (req, res) => {
  try {
    const { email, pin } = req.body;
    const result = await authService.verifyPIN(email, pin, getReqInfo(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Complete Profile (with PIN)
router.post('/complete-profile', async (req, res) => {
  try {
    const result = await authService.completeProfile(req.body, getReqInfo(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Telegram Login
router.post('/telegram', async (req, res) => {
  try {
    const result = await authService.verifyTelegramAuth(req.body, getReqInfo(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Protected Routes
router.patch('/profile', protect, async (req, res) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/toggle-movie', protect, async (req, res) => {
  try {
    const { movieId, type } = req.body;
    const result = await authService.toggleMovieStatus(req.user.id, movieId, type);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const users = authService.getUsersList();
    let user = users.find(u => u.id === req.user.id);
    if (!user) throw new Error("User not found");

    // Telegramdan to'liq ma'lumotni o'qib olish
    if (authService.fetchFullUser) {
      user = await authService.fetchFullUser(user);
    }

    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
