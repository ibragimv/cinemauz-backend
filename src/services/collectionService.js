const { getClient } = require('../telegram/client');
const config = require('../config');
const cache = require('./cacheService');

const CHANNEL_ID = config.CHANNEL_ID;
const COLLECTIONS_TAG = '#CINEMA_COLLECTIONS_CONFIG';

// Kanaldan kolleksiyalar sozlamalarini olish
async function fetchCollectionsConfig() {
  const cached = await cache.get(cache.KEYS.COLLECTIONS_CONFIG);
  if (cached) return cached;

  console.log('📂 Kolleksiyalar sozlamalarini qidirish boshlandi...');
  const client = await getClient();
  
  // Oxirgi 100 ta xabarni olib tekshiramiz (Search o'rniga ishonchliroq)
  const messages = await client.getMessages(CHANNEL_ID, { limit: 100 });
  const configMsg = messages.find(m => m.message?.includes(COLLECTIONS_TAG));

  if (!configMsg) {
    console.log('📂 Kolleksiyalar sozlamalari topilmadi.');
    return [];
  }

  try {
    const text = configMsg.message;
    const jsonStr = text.split(COLLECTIONS_TAG)[1].trim();
    const config = JSON.parse(jsonStr);
    
    console.log(`📂 Kolleksiyalar yuklandi: ${config.length} ta`);
    await cache.set(cache.KEYS.COLLECTIONS_CONFIG, config, cache.TTL.MOVIES_ALL);
    return config;
  } catch (err) {
    console.error('📂 Collections Config Parse Error:', err.message);
    return [];
  }
}

// Kolleksiyalar sozlamalarini saqlash
async function saveCollectionsConfig(collections) {
  console.log(`📂 Kolleksiyalarni saqlash: ${collections.length} ta`);
  const client = await getClient();
  
  // Eski xabarlarni topish va o'chirish
  const messages = await client.getMessages(CHANNEL_ID, { limit: 100 });
  const oldMsgIds = messages
    .filter(m => m.message?.includes(COLLECTIONS_TAG))
    .map(m => m.id);

  if (oldMsgIds.length > 0) {
    console.log(`📂 Eski ${oldMsgIds.length} ta sozlama xabari o'chirilmoqda...`);
    await client.deleteMessages(CHANNEL_ID, oldMsgIds, { revoke: true });
  }

  // Yangisini yuborish
  const text = `${COLLECTIONS_TAG}\n${JSON.stringify(collections)}`;
  const sent = await client.sendMessage(CHANNEL_ID, { message: text });
  
  console.log(`📂 Yangi sozlamalar saqlandi (Msg ID: ${sent.id})`);
  await cache.invalidateAll();
}

module.exports = {
  fetchCollectionsConfig,
  saveCollectionsConfig
};
