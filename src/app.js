require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getClient } = require('./telegram/client');
const { redis } = require('./services/cacheService');
const moviesRouter = require('./routes/movies');
const streamRouter = require('./routes/stream');
const { apiLimiter, streamLimiter } = require('./middleware/rateLimit');
const config = require('./config');

const app = express();

// Request Logger
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: true, // Hamma originlarga ruxsat berish (development uchun)
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/movies', apiLimiter, moviesRouter);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/stream', streamLimiter, streamRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Topilmadi' });
});

// ─── START ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    // GramJS ulash
    await getClient();

    // Bot yuklash
    require('./bot/index');

    // Server ishga tushurish
    app.listen(config.PORT, () => {
      console.log(`✅ Server ishlamoqda: http://localhost:${config.PORT}`);
      console.log(`📡 API: http://localhost:${config.PORT}/api/movies`);
      console.log(`🎬 Stream: http://localhost:${config.PORT}/stream/:id`);
    });
  } catch (err) {
    console.error('❌ Start xatosi:', err);
    process.exit(1);
  }
}

start();
