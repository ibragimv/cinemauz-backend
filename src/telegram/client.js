const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('../config');

let client = null;
let connectionPromise = null;

async function getClient() {
  if (client && client.connected) return client;

  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      if (!client) {
        const session = new StringSession(config.SESSION);
        client = new TelegramClient(session, config.API_ID, config.API_HASH, {
          connectionRetries: 5,
          retryDelay: 1000,
          autoReconnect: true,
        });
      }

      if (!client.connected) {
        try {
          await client.connect();
        } catch (err) {
          if (err.errorMessage === 'AUTH_KEY_DUPLICATED') {
            console.warn('⚠️ AUTH_KEY_DUPLICATED: Boshqa instansiya ishlayotgan bo\'lishi mumkin. 5 soniya kutilmoqda...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await client.connect();
          } else {
            throw err;
          }
        }
        console.log('✅ GramJS ulandi');
      }
      return client;
    } catch (error) {
      console.error('❌ GramJS ulanishda xato:', error);
      client = null; // Keyingi safar qaytadan urinib ko'rish uchun
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

module.exports = { getClient };
