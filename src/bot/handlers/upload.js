const bot = require('../../telegram/bot');
const { STATES, getSession, setState, updateData, clearSession } = require('../session');
const kb = require('../keyboards');
const movieService = require('../../services/movieService');
const tmdbService = require('../../services/tmdbService');
const config = require('../../config');
const cache = require('../../services/cacheService');

const CHANNEL_ID = config.CHANNEL_ID;

/**
 * UPLOAD START
 */
async function startUpload(chatId, userId, msgId) {
  clearSession(userId);
  const text = `➕ *Yangi kino qo'shish*\n\nQanday usulda qo'shmoqchisiz?`;
  const options = {
    chat_id: chatId, message_id: msgId,
    parse_mode: 'Markdown', reply_markup: kb.uploadMethodsKeyboard(),
  };
  try {
    await bot.editMessageText(text, options);
  } catch {
    await bot.sendMessage(chatId, text, options);
  }
}

/**
 * TMDB SELECT (MOVIE & SERIES)
 */
async function handleTmdbSelect(chatId, userId, tmdbId) {
  const statusMsg = await bot.sendMessage(chatId, "⏳ Ma'lumotlar olinmoqda...");
  try {
    const movieInfo = await tmdbService.getMovieDetails(tmdbId);
    updateData(userId, { ...movieInfo, tmdb_id: tmdbId, type: 'movie' });
    setState(userId, STATES.UPLOAD_TMDB_TITLE, { ...movieInfo, tmdb_id: tmdbId, type: 'movie' });
    await bot.deleteMessage(chatId, statusMsg.message_id);
    return bot.sendMessage(chatId, `✅ *Kino topildi:* ${movieInfo.title}\n\n✍️ *O'zbekcha nomini yozing:*`, { reply_markup: kb.cancelKeyboard() });
  } catch (err) {
    return bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleSeriesSelect(chatId, userId, tmdbId) {
  const statusMsg = await bot.sendMessage(chatId, "⏳ Serial ma'lumotlari olinmoqda...");
  try {
    const seriesInfo = await tmdbService.getSeriesDetails(tmdbId);
    updateData(userId, { ...seriesInfo, tmdb_id: tmdbId, type: 'series' });
    setState(userId, STATES.UPLOAD_SERIES_TMDB_TITLE, { ...seriesInfo, tmdb_id: tmdbId, type: 'series' });
    await bot.deleteMessage(chatId, statusMsg.message_id);
    return bot.sendMessage(chatId, `✅ *Serial topildi:* ${seriesInfo.title}\n\n✍️ *O'zbekcha nomini yozing:*`, { reply_markup: kb.cancelKeyboard() });
  } catch (err) {
    return bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

/**
 * MESSAGE HANDLER
 */
async function handleUploadMessage(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const { state, data } = getSession(userId);

  if (msg.text?.startsWith('/select_tmdb_')) return handleTmdbSelect(chatId, userId, msg.text.replace('/select_tmdb_', ''));
  if (msg.text?.startsWith('/select_series_')) return handleSeriesSelect(chatId, userId, msg.text.replace('/select_series_', ''));

  // Logic for Uzbek Title
  if (state === STATES.UPLOAD_TMDB_TITLE || state === STATES.UPLOAD_SERIES_TMDB_TITLE) {
    const title = msg.text?.trim();
    if (!title) return bot.sendMessage(chatId, '⚠️ Nomini yozing:');

    updateData(userId, { title });
    setState(userId, STATES.UPLOAD_IS_PREMIERE, { ...data, title });

    return bot.sendMessage(chatId, `🔥 *Qadam 7/12*\nBu ${data.type === 'series' ? 'serial' : 'kino'} premyerami?`, {
      parse_mode: 'Markdown', reply_markup: kb.premiereKeyboard()
    });
  }

  // Manual Season Number Entry
  if (state === 'UPLOAD_SERIES_SEASON_NUM') {
    const seasonNum = parseInt(msg.text);
    if (isNaN(seasonNum)) return bot.sendMessage(chatId, '⚠️ Iltimos raqam kiriting (masalan: 2):');

    updateData(userId, { current_season: seasonNum, episodes: [], current_ep: 1 });
    setState(userId, STATES.UPLOAD_SERIES_EPISODES, { ...data, current_season: seasonNum, episodes: [], current_ep: 1 });

    return bot.sendMessage(chatId, `✅ *${seasonNum}-fasl* tanlandi.\n\n📼 1-qism videosini yuboring:`, { reply_markup: kb.cancelKeyboard() });
  }

  // Episodic Upload
  if (state === STATES.UPLOAD_SERIES_EPISODES) {
    const doc = msg.document || msg.video;
    if (!doc) return bot.sendMessage(chatId, '⚠️ Video fayl yuboring.');
    const epNum = data.current_ep || 1;
    const statusMsg = await bot.sendMessage(chatId, `⏳ ${epNum}-qism yuklanmoqda...`);
    try {
      const sent = await bot.copyMessage(CHANNEL_ID, chatId, msg.message_id);
      const episodes = [...(data.episodes || []), { ep: epNum, msg_id: sent.message_id, size: doc.file_size || 0 }];
      updateData(userId, { episodes, current_ep: epNum + 1 });
      return bot.editMessageText(`✅ *${epNum}-qism tayyor!*\n\n⏭️ Keyingisini yuboring yoki "Tayyor" ni bosing.`, {
        chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✅ Tayyor', callback_data: 'upload:series:done' }], [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }]] }
      });
    } catch (err) {
      return bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
    }
  }

  // Video/Parts Upload
  if (state === STATES.UPLOAD_VIDEO) {
    const doc = msg.document || msg.video;
    if (!doc) return bot.sendMessage(chatId, '⚠️ Video yuboring.', { reply_markup: kb.videoPartsKeyboard(data.parts?.length || 0) });
    const statusMsg = await bot.sendMessage(chatId, '⏳ Yuklanmoqda...');
    try {
      const sent = await bot.copyMessage(CHANNEL_ID, chatId, msg.message_id);
      const parts = [...(data.parts || []), { index: (data.parts || []).length, channel_msg_id: sent.message_id, size: doc.file_size || 0 }];
      updateData(userId, { parts });
      return bot.editMessageText(`✅ ${parts.length}-qism yuklandi.\nYana yuborasizmi?`, {
        chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown', reply_markup: kb.videoPartsKeyboard(parts.length)
      });
    } catch (err) {
      return bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
    }
  }

  // Poster Upload
  if (state === STATES.UPLOAD_POSTER) {
    const photo = msg.photo;
    if (!photo) return bot.sendMessage(chatId, '⚠️ Rasm yuboring.');
    const fileId = photo[photo.length - 1].file_id;
    updateData(userId, { poster_file_id: fileId });
    setState(userId, STATES.UPLOAD_VIDEO, { ...data, poster_file_id: fileId, parts: [] });
    return bot.sendMessage(chatId, `🖼️ Poster OK. Endi video yuboring.`, { reply_markup: kb.videoPartsKeyboard(0) });
  }

  // Manual Steps Logic
  const steps = {
    [STATES.UPLOAD_TITLE]: { field: 'title', next: STATES.UPLOAD_ORIGINAL_TITLE },
    [STATES.UPLOAD_ORIGINAL_TITLE]: { field: 'original_title', next: STATES.UPLOAD_YEAR },
    [STATES.UPLOAD_YEAR]: { field: 'year', next: STATES.UPLOAD_COUNTRY, transform: v => parseInt(v) },
    [STATES.UPLOAD_COUNTRY]: { field: 'country', next: STATES.UPLOAD_GENRE, transform: v => v.split(',').map(s => s.trim()) },
    [STATES.UPLOAD_GENRE]: { field: 'genre', next: STATES.UPLOAD_RATING },
    [STATES.UPLOAD_RATING]: { field: 'rating', next: STATES.UPLOAD_IS_PREMIERE, transform: v => parseFloat(v) },
    [STATES.UPLOAD_DURATION]: { field: 'duration', next: STATES.UPLOAD_DESCRIPTION, transform: v => parseInt(v) },
    [STATES.UPLOAD_DESCRIPTION]: { field: 'description', next: STATES.UPLOAD_POSTER }
  };

  const step = steps[state];
  if (!step) return;
  const value = step.transform ? step.transform(msg.text) : msg.text;
  const newData = { ...data, [step.field]: value };
  setState(userId, step.next, newData);

  const labels = {
    [STATES.UPLOAD_TITLE]: 'Original nomini yozing:',
    [STATES.UPLOAD_ORIGINAL_TITLE]: 'Yilini yozing:',
    [STATES.UPLOAD_YEAR]: 'Davlatini yozing:',
    [STATES.UPLOAD_COUNTRY]: 'Janrini yozing:',
    [STATES.UPLOAD_GENRE]: 'Reytingini yozing:',
    [STATES.UPLOAD_RATING]: null, // Premiere keyboard follows
    [STATES.UPLOAD_DURATION]: 'Tavsifini yozing:',
    [STATES.UPLOAD_DESCRIPTION]: 'Poster rasmini yuboring:'
  };

  if (state === STATES.UPLOAD_RATING) {
    return bot.sendMessage(chatId, `🔥 Bu ${data.type === 'series' ? 'serial' : 'kino'} premyerami?`, { reply_markup: kb.premiereKeyboard() });
  }

  if (labels[state]) return bot.sendMessage(chatId, `✅ OK. ${labels[state]}`, { reply_markup: kb.cancelKeyboard() });
}

/**
 * CALLBACK HANDLER
 */
async function handleUploadCallback(query, action) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const { data } = getSession(userId);

  if (action === 'cancel') {
    clearSession(userId);
    return bot.editMessageText('❌ Bekor qilindi.', { chat_id: chatId, message_id: msgId, reply_markup: kb.mainMenu() });
  }

  if (action === 'method:tmdb' || action === 'series:tmdb') {
    const isSeries = action.includes('series');
    setState(userId, isSeries ? 'UPLOAD_SERIES_TMDB_ID' : STATES.UPLOAD_TMDB_ID, { type: isSeries ? 'series' : 'movie' });
    return bot.editMessageText(`🔍 Qidirish uchun: \`@${(await bot.getMe()).username} ${isSeries ? 's ' : ''}nomi\``, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.cancelKeyboard()
    });
  }

  if (action === 'method:manual' || action === 'series:manual') {
    const isSeries = action.includes('series');
    setState(userId, STATES.UPLOAD_TITLE, { type: isSeries ? 'series' : 'movie', parts: [] });
    return bot.editMessageText(`${isSeries ? 'Serial' : 'Kino'} nomini yozing:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.cancelKeyboard() });
  }

  if (action.startsWith('premiere:')) {
    const isPremiere = action === 'premiere:yes';
    const newData = { ...data, is_premiere: isPremiere };
    setState(userId, 'UPLOAD_EXCLUSIVE', newData);
    return bot.editMessageText(`💎 Bu eksklyuziv (faqat Premium uchun) kontentmi?`, { chat_id: chatId, message_id: msgId, reply_markup: kb.exclusiveKeyboard() });
  }

  if (action.startsWith('exclusive:')) {
    const isExclusive = action === 'exclusive:yes';
    const newData = { ...data, is_exclusive: isExclusive };
    setState(userId, STATES.UPLOAD_LANGUAGE, newData);
    return bot.editMessageText(`🗣️ Tilni tanlang:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.languageKeyboard() });
  }

  if (action.startsWith('lang:')) {
    const language = action.split(':')[1];
    updateData(userId, { language });
    setState(userId, STATES.UPLOAD_QUALITY, { ...data, language });
    return bot.editMessageText(`📺 Sifatni tanlang:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.qualityKeyboard() });
  }

  if (action.startsWith('quality:')) {
    const quality = action.split(':')[1];
    updateData(userId, { quality });
    if (data.tmdb_id) {
      if (data.type === 'series') {
        setState(userId, 'UPLOAD_SERIES_SEASON', { ...data, quality });
        return bot.editMessageText(`📅 Faslni tanlang:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.seasonSelectKeyboard(data.seasons) });
      }
      setState(userId, STATES.UPLOAD_VIDEO, { ...data, quality, parts: [] });
      return bot.editMessageText(`🎬 Video yuboring:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.videoPartsKeyboard(0) });
    }
    setState(userId, STATES.UPLOAD_DURATION, { ...data, quality });
    return bot.editMessageText(`⏱️ Davomiyligini yozing (daq):`, { chat_id: chatId, message_id: msgId, reply_markup: kb.cancelKeyboard() });
  }

  if (action === 'series:new_season') {
    setState(userId, 'UPLOAD_SERIES_SEASON_NUM', data);
    return bot.editMessageText('✍️ Yangi fasl raqamini yozing (masalan: 2):', { chat_id: chatId, message_id: msgId, reply_markup: kb.cancelKeyboard() });
  }

  if (action.startsWith('series:season:')) {
    const seasonNum = parseInt(action.split(':')[2]);
    setState(userId, STATES.UPLOAD_SERIES_EPISODES, { ...data, current_season: seasonNum, episodes: [], current_ep: 1 });
    return bot.editMessageText(`📺 ${seasonNum}-fasl. 1-qism videosini yuboring:`, { chat_id: chatId, message_id: msgId, reply_markup: kb.cancelKeyboard() });
  }

  if (action === 'series:done') return showSeriesSummary(chatId, userId, msgId);
  if (action === 'video:done') return showSummary(chatId, userId, msgId);
  if (action === 'confirm:yes') return saveMovie(chatId, userId, data);
}

/**
 * FINAL SAVE & HELPERS
 */
async function showSummary(chatId, userId, msgId) {
  const { data } = getSession(userId);
  setState(userId, STATES.UPLOAD_CONFIRM, data);
  const text = `📋 *Xulosa:*\n🎬 *Nom:* ${data.title}\n📅 *Yil:* ${data.year}\n⭐ *Reyting:* ${data.rating}\n💎 *Eksklyuziv:* ${data.is_exclusive ? 'Ha' : 'Yo\'q'}\n\n✅ Saqlaymizmi?`;
  return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard() });
}

async function showSeriesSummary(chatId, userId, msgId) {
  const { data } = getSession(userId);
  setState(userId, STATES.UPLOAD_CONFIRM, data);
  const text = `📊 *Serial Xulosasi:*\n📺 *Nom:* ${data.title}\n📅 *Fasl:* ${data.current_season}\n📼 *Qismlar:* ${data.episodes?.length} ta\n💎 *Eksklyuziv:* ${data.is_exclusive ? 'Ha' : 'Yo\'q'}\n\n✅ Saqlaymizmi?`;
  return bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.confirmKeyboard() });
}

async function saveMovie(chatId, userId, data) {
  try {
    const isSeries = data.type === 'series';

    // Keshni chetlab o'tib eng yangi ma'lumotlarni olamiz
    await cache.invalidateAll();
    const allMovies = await movieService.fetchAllMovies();

    // Mavjud serialni qidirish (TMDB ID yoki Nomi bo'yicha)
    let existingMovie = allMovies.find(m => {
      if (m.type !== 'series') return false;
      if (data.tmdb_id && m.tmdb_id == data.tmdb_id) return true;
      if (data.title && m.title.toLowerCase() === data.title.toLowerCase()) return true;
      return false;
    });

    console.log(`🔍 Mavjud serial topildimi: ${existingMovie ? 'Ha (' + existingMovie.title + ')' : 'Yo\'q'}`);

    let seasons = [];
    if (isSeries) {
      if (existingMovie && existingMovie.seasons) {
        seasons = JSON.parse(JSON.stringify(existingMovie.seasons)); // Chuqur nusxa
        const sIdx = seasons.findIndex(s => s.num == data.current_season);
        if (sIdx > -1) {
          seasons[sIdx].episodes = data.episodes;
        } else {
          seasons.push({ num: data.current_season, episodes: data.episodes });
        }
      } else {
        seasons = [{ num: data.current_season, episodes: data.episodes }];
      }
    }

    const items = isSeries ? data.episodes : data.parts;
    const totalSize = (items || []).reduce((s, p) => s + (p.size || 0), 0);

    const movieData = { ...data, total_size: totalSize, created_at: new Date().toISOString() };
    if (isSeries) movieData.seasons = seasons;

    // Agar mavjud bo'lsa, eski ID ni saqlab qolamiz
    if (existingMovie) movieData.id = existingMovie.id;

    const { caption, metadata } = await movieService.buildMetaCaption(movieData);
    const targetPosterId = existingMovie ? existingMovie.poster_msg_id : null;

    if (targetPosterId) {
      await bot.sendMessage(CHANNEL_ID, metadata, { reply_to_message_id: parseInt(targetPosterId) });
    } else {
      const poster = data.poster_file_id || data.poster_path;
      const photoMsg = await bot.sendPhoto(CHANNEL_ID, poster, { caption, parse_mode: 'Markdown' });
      await bot.sendMessage(CHANNEL_ID, metadata, { reply_to_message_id: photoMsg.message_id });
    }

    await cache.invalidateAll();
    clearSession(userId);
    return bot.sendMessage(chatId, `✅ ${existingMovie ? 'Serial yangilandi!' : 'Saqlandi!'}`, { reply_markup: kb.mainMenu() });
  } catch (err) {
    console.error('Save Error:', err);
    return bot.sendMessage(chatId, `❌ Xato: ${err.message}`, { reply_markup: kb.mainMenu() });
  }
}

/**
 * START ADD SEASON FLOW
 */
async function startAddSeason(chatId, userId, msgId, movieId) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return bot.answerCallbackQuery(null, { text: '❌ Serial topilmadi!' });

  clearSession(userId);
  // Mavjud ma'lumotlarni sessiyaga yuklash
  updateData(userId, { ...movie, type: 'series' });
  setState(userId, 'UPLOAD_SERIES_SEASON', { ...movie, type: 'series' });

  return bot.editMessageText(`📺 *${movie.title}* serialiga yangi fasl qo'shish\n\n📅 Faslni tanlang:`, {
    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
    reply_markup: kb.seasonSelectKeyboard(movie.seasons || [])
  });
}

module.exports = { startUpload, handleUploadMessage, handleUploadCallback, startAddSeason };
