require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  CHANNEL_ID: process.env.CHANNEL_ID,
  ADMIN_IDS: process.env.ADMIN_IDS?.split(',').map(id => parseInt(id.trim())) || [],
  API_ID: parseInt(process.env.TELEGRAM_API_ID),
  API_HASH: process.env.TELEGRAM_API_HASH,
  SESSION: process.env.TELEGRAM_SESSION || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  TMDB_API_KEY: process.env.TMDB_API_KEY || '',
  CLICK_PROVIDER_TOKEN: process.env.CLICK_PROVIDER_TOKEN || '',
  USERS_CHANNEL_ID: process.env.USERS_CHANNEL_ID,
  COMMENTS_CHANNEL_ID: process.env.COMMENTS_CHANNEL_ID,
  NOTIFICATIONS_CHANNEL_ID: process.env.NOTIFICATIONS_CHANNEL_ID,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:support@cinemauz.com',
  CLICK_SERVICE_ID: process.env.CLICK_SERVICE_ID || '',
  CLICK_SECRET_KEY: process.env.CLICK_SECRET_KEY || '',
};
