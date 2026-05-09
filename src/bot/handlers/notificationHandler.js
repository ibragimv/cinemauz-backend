const bot = require('../../telegram/bot');
const { STATES, getSession, setState, updateData, clearSession } = require('../session');
const notificationService = require('../../services/notificationService');
const movieService = require('../../services/movieService');

async function startNotification(chatId, userId) {
  setState(userId, STATES.NOTIF_TITLE, { movieId: null });
  bot.sendMessage(chatId, '🔔 <b>Yangi bildirishnoma yaratish</b>\n\nSarlavhani kiriting:', { parse_mode: 'HTML' });
}

async function startMovieNotification(chatId, userId, movieId) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return bot.sendMessage(chatId, '❌ Kino topilmadi');

  setState(userId, STATES.NOTIF_TITLE, { movieId: movie.id, movieTitle: movie.title });
  bot.sendMessage(chatId, `🎬 <b>Film bog'langan bildirishnoma</b>\nFilm: ${movie.title}\n\nSarlavhani kiriting:`, { parse_mode: 'HTML' });
}

async function handleNotificationMessage(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = getSession(userId);

  if (session.state === STATES.NOTIF_TITLE) {
    updateData(userId, { title: text });
    setState(userId, STATES.NOTIF_MESSAGE, session.data);
    return bot.sendMessage(chatId, 'Endi xabar matnini kiriting:');
  }

  if (session.state === STATES.NOTIF_MESSAGE) {
    const { title, movieId } = session.data;
    const message = text;

    bot.sendMessage(chatId, '⌛ Yuborilmoqda...');
    
    const result = await notificationService.sendNotification({
      title,
      message,
      movieId
    });

    if (result) {
      bot.sendMessage(chatId, '✅ Bildirishnoma muvaffaqiyatli yuborildi!');
    } else {
      bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
    }
    
    clearSession(userId);
  }
}

module.exports = { startNotification, startMovieNotification, handleNotificationMessage };
