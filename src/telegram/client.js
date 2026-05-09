const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('../config');

let client = null;

async function getClient() {
  if (client && client.connected) return client;

  const session = new StringSession(config.SESSION);
  client = new TelegramClient(session, config.API_ID, config.API_HASH, {
    connectionRetries: 5,
    retryDelay: 1000,
    autoReconnect: true,
  });

  await client.connect();
  console.log('✅ GramJS ulandi');
  return client;
}

module.exports = { getClient };
