const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 daqiqa
  max: 200,                   // IP boshiga 200 so'rov
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Juda ko\'p so\'rov. Bir daqiqadan keyin urinib ko\'ring.' },
});

const streamLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 daqiqa
  max: 30,                    // Stream uchun kamroq
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Stream limiti oshib ketdi.' },
});

module.exports = { apiLimiter, streamLimiter };
