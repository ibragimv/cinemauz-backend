const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const authService = require('../services/auth.service');
const { protect } = require('../middlewares/auth.middleware');

// GET /api/notifications - Barcha bildirishnomalarni olish
router.get('/', async (req, res) => {
  try {
    const notifications = await notificationService.fetchAllNotifications();
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/subscribe - Push obunani saqlash
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    // User profilini yangilash va obunani qo'shish
    const user = await authService.fetchFullUser({ id: userId, telegram_message_id: req.user.telegram_message_id });
    
    user.pushSubscriptions = user.pushSubscriptions || [];
    // Takrorlanmasligini tekshirish
    const exists = user.pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push(subscription);
      await authService.updateProfile(userId, { pushSubscriptions: user.pushSubscriptions });
    }
    
    res.json({ success: true, message: 'Obuna saqlandi' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin uchun: Bildirishnoma yuborish (Faqat adminlar uchun, bu bot orqali ham bo'ladi)
router.post('/send', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Ruxsat berilmagan' });
  }

  try {
    const { title, message, movieId } = req.body;
    const result = await notificationService.sendNotification({ title, message, movieId });
    
    // Barcha userlarga Push yuborish logic
    const users = authService.getUsersList();
    for (const user of users) {
      if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
        for (const sub of user.pushSubscriptions) {
          notificationService.sendPushNotification(sub, {
            title,
            body: message,
            data: { movieId }
          });
        }
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
