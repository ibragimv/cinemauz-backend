const bot = require('../telegram/bot');
const config = require('../config');
const { STATES, getSession } = require('./session');
const { handleStart, showMainMenu, isAdmin } = require('./handlers/start');
const { startUpload, handleUploadMessage, handleUploadCallback } = require('./handlers/upload');
const { showMoviesList, showMovieDetail, showExclusiveList } = require('./handlers/moviesList');
const { confirmDelete, executeDelete } = require('./handlers/deleteHandler');
const { showEditMenu, askFieldValue, saveEditValue, saveButtonEditValue } = require('./handlers/editHandler');
const { startSearch, handleSearchQuery } = require('./handlers/searchHandler');
const { showStats } = require('./handlers/statsHandler');
const collectionsHandler = require('./handlers/collections');
const notifHandler = require('./handlers/notificationHandler');

// ─── TEXT MESSAGES ────────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  try {
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;

    const session = getSession(userId);

    // TMDB Select xabari har doim birinchi tekshirilishi kerak
    if (msg.text?.startsWith('/select_tmdb_') || msg.text?.startsWith('/select_series_')) {
      return handleUploadMessage(msg);
    }

    // Birinchi kelgan xabar → bosh menu
    if (session.state === STATES.IDLE) {
      return showMainMenu(msg.chat.id);
    }

    // Edit holati
    if (session.state === STATES.EDIT_FIELD_VALUE) {
      const handled = await saveEditValue(msg);
      if (handled) return;
    }

    // Qidiruv holati
    if (session.state === STATES.SEARCH_QUERY) {
      const handled = await handleSearchQuery(msg);
      if (handled) return;
    }

    // Upload holati
    if (session.state?.startsWith('UPLOAD_')) {
      return handleUploadMessage(msg);
    }

    // Bildirishnoma holati
    if (session.state?.startsWith('NOTIF_')) {
      return notifHandler.handleNotificationMessage(msg);
    }


  } catch (err) {
    console.error('Bot xabar xatosi:', err);
  }
});

// ─── CALLBACK QUERIES (INLINE BUTTONS) ───────────────────────────────────────
bot.on('callback_query', async (query) => {
  try {
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    if (!isAdmin(userId)) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Ruxsat yo\'q' });
    }

    await bot.answerCallbackQuery(query.id);

    // noop — hech narsa qilma
    if (data === 'noop') return;

    const [ns, ...rest] = data.split(':');

    // ─── MENU ──────────────────────────────────────────────────────
    if (data === 'main_menu' || (ns === 'menu' && rest[0] === 'main')) {
      return showMainMenu(chatId, msgId);
    }

    // ─── UPLOAD ────────────────────────────────────────────────────
    if (ns === 'upload') {
      const action = rest.join(':');
      if (action === 'start') return startUpload(chatId, userId, msgId);
      if (action.startsWith('add_season:')) {
        const movieId = action.split(':')[1];
        const { startAddSeason } = require('./handlers/upload');
        return startAddSeason(chatId, userId, msgId, movieId);
      }
      return handleUploadCallback(query, action);
    }

    // ─── MOVIES LIST ───────────────────────────────────────────────
    if (ns === 'movies' && rest[0] === 'list') {
      return showMoviesList(chatId, msgId, parseInt(rest[1]) || 0);
    }

    if (ns === 'movies' && rest[0] === 'exclusive') {
      return showExclusiveList(chatId, msgId, parseInt(rest[1]) || 0);
    }

    // ─── MOVIE DETAIL ──────────────────────────────────────────────
    if (ns === 'movie' && rest[0] === 'view') {
      const movieId = rest[1];
      const page = parseInt(rest[2]) || 0;
      const isExclusive = rest[3] === 'exclusive';
      return showMovieDetail(chatId, msgId, movieId, page, isExclusive);
    }

    // ─── DELETE ────────────────────────────────────────────────────
    if (ns === 'delete') {
      if (rest[0] === 'confirm') return confirmDelete(chatId, msgId, rest[1]);
      if (rest[0] === 'yes') return executeDelete(chatId, msgId, rest[1]);
    }

    // ─── EDIT ──────────────────────────────────────────────────────
    if (ns === 'edit') {
      if (rest[0] === 'start') return showEditMenu(chatId, msgId, rest[1]);
      if (rest[0] === 'field') return askFieldValue(chatId, msgId, rest[1], rest[2], userId);
      if (rest[0] === 'premiere') return askFieldValue(chatId, msgId, 'premiere', rest[1], userId);
      if (rest[0] === 'quality') return askFieldValue(chatId, msgId, 'quality', rest[1], userId);
      if (rest[0] === 'language') return askFieldValue(chatId, msgId, 'language', rest[1], userId);
      if (rest[0] === 'exclusive') return askFieldValue(chatId, msgId, 'exclusive', rest[1], userId);
      if (rest[0] === 'set') {
        const [field, value, movieId] = rest.slice(1);
        return saveButtonEditValue(chatId, msgId, field, value, movieId);
      }
    }

    // ─── SEARCH ────────────────────────────────────────────────────
    if (ns === 'search' && rest[0] === 'start') {
      return startSearch(chatId, msgId, userId);
    }

    // ─── STATS ─────────────────────────────────────────────────────
    if (ns === 'stats' && rest[0] === 'show') {
      return showStats(chatId, msgId);
    }

    // ─── COLLECTIONS ───────────────────────────────────────────────
    if (ns === 'col') {
      if (rest[0] === 'main') return collectionsHandler.startCollections(chatId, userId, msgId);
      if (rest[0] === 'genre' && rest[1] === 'toggle') return collectionsHandler.handleGenreToggle(query, rest[2]);
      if (rest[0] === 'finish') return collectionsHandler.finishCollectionAdd(query);
      return collectionsHandler.handleCollectionsCallback(query, data);
    }

    // ─── NOTIFICATIONS ───────────────────────────────────────────────
    if (ns === 'notif') {
      if (rest[0] === 'start') return notifHandler.startNotification(chatId, userId);
      if (rest[0] === 'movie') return notifHandler.startMovieNotification(chatId, userId, rest[1]);
    }

    // ─── USERS ─────────────────────────────────────────────────────
    if (ns === 'users' && rest[0] === 'stats') {
      const { showUsersStats } = require('./handlers/usersHandler');
      return showUsersStats(chatId, msgId);
    }


  } catch (err) {
    console.error('Callback xatosi:', err.message);
  }
});

// ─── INLINE QUERIES (TMDB SEARCH) ───────────────────────────────────────────
bot.on('inline_query', async (query) => {
  console.log(`🔍 Inline query keldi: "${query.query}" (User ID: ${query.from.id})`);
  try {
    const userId = query.from.id;
    if (!isAdmin(userId)) {
      console.log('⚠️ Foydalanuvchi admin emas.');
      return;
    }

    const q = query.query.trim();
    if (!q) return;

    const tmdbService = require('../services/tmdbService');
    
    // Agar qidiruv 's ' bilan boshlansa - serial qidirish
    const isSeriesSearch = q.startsWith('s ') || q.startsWith('S ');
    const searchQ = isSeriesSearch ? q.substring(2).trim() : q;
    
    let results;
    if (isSeriesSearch) {
      results = await tmdbService.searchSeries(searchQ);
    } else {
      results = await tmdbService.searchMovies(searchQ);
    }

    const inlineResults = results.map(m => ({
      type: 'article',
      id: m.id.toString(),
      title: `${isSeriesSearch ? '📺' : '🎬'} ${m.title} (${m.year || 'N/A'})`,
      description: `⭐ ${m.rating} | ${m.description?.substring(0, 50)}...`,
      thumb_url: m.poster_path || 'https://via.placeholder.com/150x225?text=No+Poster',
      input_message_content: {
        message_text: isSeriesSearch ? `/select_series_${m.id}` : `/select_tmdb_${m.id}`,
      },
    }));

    await bot.answerInlineQuery(query.id, inlineResults, { cache_time: 300 });
  } catch (err) {
    console.error('Inline Query Error:', err.message);
  }
});

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true)
    .catch(err => console.error('Pre-checkout error:', err.message));
});

bot.on('successful_payment', async (msg) => {
  try {
    const payment = msg.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const { userId, plan } = payload;
    
    const authService = require('../services/auth.service');
    const users = authService.getUsersList();
    const user = users.find(u => u.id === userId);
    
    if (user) {
      const months = plan === '1_month' ? 1 : (plan === '3_month' ? 3 : 12);
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + months);
      
      user.subscription = {
        plan,
        isActive: true,
        startDate: new Date().toISOString(),
        expiryDate: expiryDate.toISOString()
      };
      
      // Bazani yangilash va keshni o'chirish
      await authService.updateProfile(user.id, { subscription: user.subscription });
      
      bot.sendMessage(msg.chat.id, `✅ Tabriklaymiz! Sizning ${plan} tarifingiz faollashtirildi. 🍿\n\nEndi barcha eksklyuziv kontentlar siz uchun ochiq!`);
      console.log(`💎 [Payment] Premium faollashtirildi: ${user.email} (${plan})`);
    }
  } catch (err) {
    console.error('Successful payment error:', err.message);
  }
});

console.log('🤖 Bot ishga tushdi');
module.exports = bot;
