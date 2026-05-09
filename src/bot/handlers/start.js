const bot = require('../../telegram/bot');
const { STATES, setState, clearSession } = require('../session');
const kb = require('../keyboards');
const config = require('../../config');

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(userId);
}

async function showMainMenu(chatId, msgId = null) {
  const text = `🎬 *Cinema Admin Panel*\n\nNimani qilmoqchisiz?`;
  if (msgId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId, message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: kb.mainMenu(),
      });
    } catch {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: kb.mainMenu(),
      });
    }
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: kb.mainMenu(),
    });
  }
}

async function handleStart(msg) {
  const { id: chatId, id: userId } = msg.from;
  if (!isAdmin(userId)) {
    return bot.sendMessage(chatId, '⛔ Siz admin emassiz.');
  }
  clearSession(userId);
  await showMainMenu(chatId);
}

module.exports = { handleStart, showMainMenu, isAdmin };
