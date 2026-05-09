const { getClient } = require('../telegram/client');
const bot = require('../telegram/bot');
const config = require('../config');
const webpush = require('web-push');
const cron = require('node-cron');
const movieService = require('./movieService');

const CHANNEL_ID = config.NOTIFICATIONS_CHANNEL_ID;

// Setup Web Push
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    config.VAPID_SUBJECT,
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY
  );
}

class NotificationService {
  constructor() {
    // Har kuni yarim tunda eski xabarlarni o'chirish (30 kundan oshgan)
    cron.schedule('0 0 * * *', () => {
      this.cleanupOldNotifications();
    });
  }

  async fetchAllNotifications() {
    if (!CHANNEL_ID) return [];
    try {
      const client = await getClient();
      const messages = await client.getMessages(CHANNEL_ID, { limit: 100 });
      
      const notifications = [];
      for (const msg of messages) {
        if (!msg.text) continue;
        
        try {
          // Xabar formati: 🔔 [TITLE]\n\n[MESSAGE]\n\n#metadata{...}
          const metadataMatch = msg.text.match(/#metadata(\{.*\})/);
          if (metadataMatch) {
            const data = JSON.parse(metadataMatch[1]);
            notifications.push({
              id: msg.id,
              date: new Date(msg.date * 1000).toISOString(),
              ...data
            });
          }
        } catch (e) {
          console.error('Error parsing notification metadata:', e);
        }
      }
      return notifications;
    } catch (err) {
      console.error('Fetch Notifications Error:', err);
      return [];
    }
  }

  async sendNotification({ title, message, movieId = null, target = 'all' }) {
    if (!CHANNEL_ID) return null;

    let movieDetails = null;
    if (movieId) {
      movieDetails = await movieService.getMovieById(movieId);
    }

    const metadata = {
      title,
      message,
      movieId,
      type: movieId ? 'movie' : 'simple',
      movieTitle: movieDetails?.title,
      moviePoster: movieDetails?.poster_path,
      movieGenre: movieDetails?.genre
    };

    const text = `🔔 <b>${title}</b>\n\n${message}\n\n${movieId ? `🎬 <b>Film:</b> ${movieDetails?.title}\n` : ''}\n#metadata${JSON.stringify(metadata)}`;

    try {
      const sent = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' });
      
      // Web Push yuborish (ixtiyoriy, agar obuna bo'lganlar bo'lsa)
      // Bu qismda barcha userlarning push obunalarini aylanib chiqish kerak
      // Hozircha faqat Telegramga yuboramiz, push logicni alohida qo'shamiz
      
      return { id: sent.message_id, ...metadata };
    } catch (err) {
      console.error('Send Notification Error:', err);
      return null;
    }
  }

  async cleanupOldNotifications() {
    if (!CHANNEL_ID) return;
    console.log('🧹 Running notification cleanup...');
    try {
      const client = await getClient();
      const messages = await client.getMessages(CHANNEL_ID, { limit: 100 });
      
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      
      const toDelete = messages
        .filter(msg => (now - msg.date) > thirtyDaysInSeconds)
        .map(msg => msg.id);
        
      if (toDelete.length > 0) {
        await client.deleteMessages(CHANNEL_ID, toDelete, { revoke: true });
        console.log(`✅ Deleted ${toDelete.length} old notifications`);
      }
    } catch (err) {
      console.error('Cleanup Error:', err);
    }
  }

  // Web Push uchun obunani saqlash
  async sendPushNotification(subscription, payload) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Push Notification Error:', err);
      return false;
    }
  }
}

module.exports = new NotificationService();
