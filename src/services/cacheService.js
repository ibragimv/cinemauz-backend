// In-memory cache (Redis o'rniga — Redis bo'lsa almashtirish mumkin)
const store = new Map();

const KEYS = {
  MOVIES_ALL: 'cinema:movies:all',
  COLLECTIONS_CONFIG: 'cinema:collections:config',
  MOVIE: (id) => `cinema:movie:${id}`,
};

const TTL = {
  MOVIES_ALL: 300,   // 5 daqiqa
  MOVIE: 600,        // 10 daqiqa
};

async function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

async function set(key, value, ttl) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
}

async function del(key) {
  store.delete(key);
}

async function invalidateAll() {
  const prefix = 'cinema:';
  for (const key of store.keys()) {
    if (typeof key === 'string' && key.startsWith(prefix)) {
      store.delete(key);
    }
  }
  console.log('🔄 Cache tozalandi');
}

// Redis o'rniga stub (app.js da redis.connect() chaqirilmasligi uchun)
const redis = { connect: async () => {}, on: () => {} };

module.exports = { redis, KEYS, TTL, get, set, del, invalidateAll };
