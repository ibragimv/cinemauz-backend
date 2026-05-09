const bot = require('../../telegram/bot');
const kb = require('../keyboards');
const movieService = require('../../services/movieService');
const cache = require('../../services/cacheService');

// O'chirish tasdiqlash
async function confirmDelete(chatId, msgId, movieId) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return;

  const text = `🗑 *"${movie.title}"* o'chirilsinmi?\n\n⚠️ Bu amalni qaytarib bo'lmaydi!`;
  try {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.deleteConfirmKeyboard(movieId),
    });
  } catch {
    await bot.editMessageCaption(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.deleteConfirmKeyboard(movieId),
    });
  }
}

// O'chirishni amalga oshirish
async function executeDelete(chatId, msgId, movieId) {
  try {
    const movie = await movieService.getMovieById(movieId);
    if (!movie) {
      return bot.editMessageText('❌ Kino topilmadi.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: kb.mainMenu(),
      });
    }

    await movieService.deleteMovieMessages(movie);

    await bot.editMessageText(
      `✅ *"${movie.title}"* o'chirildi!`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
    );
  } catch (err) {
    console.error('O\'chirish xatosi:', err);
    await bot.sendMessage(chatId, `❌ Xato: ${err.message}`, { reply_markup: kb.mainMenu() });
  }
}

module.exports = { confirmDelete, executeDelete };
