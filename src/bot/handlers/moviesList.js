const bot = require('../../telegram/bot');
const kb = require('../keyboards');
const movieService = require('../../services/movieService');

const PAGE_SIZE = 8;

// Kinolar ro'yxatini ko'rsatish
async function showMoviesList(chatId, msgId, page = 0) {
  const allMovies = await movieService.fetchAllMovies();
  const total = allMovies.length;

  if (total === 0) {
    const text = '📭 Hozircha kinolar yo\'q.';
    return msgId
      ? bot.editMessageText(text, { chat_id: chatId, message_id: msgId, reply_markup: kb.mainMenu() })
      : bot.sendMessage(chatId, text, { reply_markup: kb.mainMenu() });
  }

  const start = page * PAGE_SIZE;
  const movies = allMovies.slice(start, start + PAGE_SIZE);

  const text = `🎞 *Kinolar ro'yxati*\nJami: *${total}* ta | Sahifa: *${page + 1}/${Math.ceil(total / PAGE_SIZE)}*`;

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.moviesListKeyboard(movies, page, total, PAGE_SIZE),
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: kb.moviesListKeyboard(movies, page, total, PAGE_SIZE),
    });
  }
}

// Bitta kinoning tafsilotlarini ko'rsatish
async function showMovieDetail(chatId, msgId, movieId, page = 0, isExclusive = false) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) {
    return bot.answerCallbackQuery(null, { text: '❌ Kino topilmadi!' });
  }

  const isSeries = movie.type === 'series';
  const text = [
    `${isSeries ? '📺' : '🎬'} *${movie.title}*`,
    movie.original_title ? `📽 _${movie.original_title}_` : '',
    movie.is_exclusive ? '💎 *Eksklyuziv*' : '',
    ``,
    `📅 *Yil:* ${movie.year}`,
    `🌍 *Davlat:* ${Array.isArray(movie.country) ? movie.country.join(', ') : movie.country || '-'}`,
    `🎭 *Janr:* ${Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre || '-'}`,
    `⭐ *Reyting:* ${movie.rating}`,
    `🔥 *Premyera:* ${movie.is_premiere ? 'Ha' : "Yo'q"}`,
    `🗣️ *Til:* ${movie.language || '-'}`,
    `📺 *Sifat:* ${movie.quality || '-'}`,
    isSeries ? `📅 *Fasllar:* ${(movie.seasons || []).map(s => s.num).join(', ') || '-'}` : `⏱️ *Davomiylik:* ${movie.duration || '-'} daq`,
    isSeries ? `📼 *Jami qismlar:* ${(movie.seasons || []).reduce((sum, s) => sum + (s.episodes?.length || 0), 0)} ta` : `📦 *Qismlar:* ${(movie.parts || []).length} ta`,
    ``,
    movie.description ? `📝 ${movie.description.length > 500 ? movie.description.substring(0, 500) + '...' : movie.description}` : '',
  ].filter(Boolean).join('\n');

  const options = {
    chat_id: chatId, message_id: msgId,
    parse_mode: 'Markdown',
    reply_markup: kb.movieDetailKeyboard(movie, page, isExclusive),
  };

  try {
    await bot.editMessageCaption(text, options);
  } catch {
    await bot.editMessageText(text, options);
  }
}

// Eksklyuziv kinolar ro'yxati
async function showExclusiveList(chatId, msgId, page = 0) {
  const allMovies = await movieService.fetchAllMovies();
  const exclusiveMovies = allMovies.filter(m => m.is_exclusive === true || m.is_exclusive === 'true');
  const total = exclusiveMovies.length;

  if (total === 0) {
    const text = '💎 *Eksklyuziv bo\'limi*\n\nHozircha eksklyuziv kontentlar mavjud emas.';
    return msgId
      ? bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.mainMenu() })
      : bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb.mainMenu() });
  }

  const start = page * PAGE_SIZE;
  const movies = exclusiveMovies.slice(start, start + PAGE_SIZE);

  const text = `💎 *Eksklyuziv To'plam*\nJami: *${total}* ta | Sahifa: *${page + 1}/${Math.ceil(total / PAGE_SIZE)}*`;

  const markup = kb.exclusiveMoviesListKeyboard(movies, page, total, PAGE_SIZE);

  if (msgId) {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: markup,
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: markup,
    });
  }
}

module.exports = { showMoviesList, showMovieDetail, showExclusiveList };
