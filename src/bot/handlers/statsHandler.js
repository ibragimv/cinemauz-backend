const bot = require('../../telegram/bot');
const kb = require('../keyboards');
const movieService = require('../../services/movieService');

async function showStats(chatId, msgId) {
  try {
    const stats = await movieService.getStats();
    const text = [
      `📊 *Statistika*`,
      ``,
      `🎬 Jami kinolar: *${stats.total}* ta`,
      `🔥 Premyeralar: *${stats.premieres}* ta`,
      `🎭 Eng ko'p janr: *${stats.topGenre}*`,
    ].join('\n');

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.backToMenuKeyboard(),
    });
  } catch (err) {
    await bot.editMessageText(`❌ Xato: ${err.message}`, {
      chat_id: chatId, message_id: msgId,
      reply_markup: kb.backToMenuKeyboard(),
    });
  }
}

module.exports = { showStats };
