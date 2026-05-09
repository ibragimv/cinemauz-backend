const bot = require('../../telegram/bot');
const kb = require('../keyboards');
const { STATES, getSession, setState, clearSession } = require('../session');
const movieService = require('../../services/movieService');

// Qidiruv boshlash
async function startSearch(chatId, msgId, userId) {
  setState(userId, STATES.SEARCH_QUERY, {});
  await bot.editMessageText(
    `🔍 *Qidiruv*\n\nKino nomini yuboring:`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.backToMenuKeyboard() }
  );
}

// Qidiruv natijalarini ko'rsatish
async function handleSearchQuery(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const session = getSession(userId);
  if (session.state !== STATES.SEARCH_QUERY) return false;

  const query = msg.text?.trim();
  if (!query) return true;

  const allMovies = await movieService.fetchAllMovies();
  const { items } = movieService.filterMovies(allMovies, { q: query, limit: 10 });

  clearSession(userId);

  if (items.length === 0) {
    return bot.sendMessage(chatId,
      `🔍 *"${query}"* bo'yicha hech narsa topilmadi.`,
      { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
    );
  }

  const text = `🔍 *"${query}"* bo'yicha ${items.length} ta natija:\n\n` +
    items.map((m, i) =>
      `${i + 1}. ${m.is_premiere ? '🔥 ' : ''}*${m.title}* (${m.year}) ⭐${m.rating}`
    ).join('\n');

  const buttons = items.map(m => ([{
    text: `${m.is_premiere ? '🔥 ' : ''}${m.title} (${m.year})`,
    callback_data: `movie:view:${m.id}:0`,
  }]));
  buttons.push([{ text: '🏠 Bosh menu', callback_data: 'menu:main' }]);

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });

  return true;
}

module.exports = { startSearch, handleSearchQuery };
