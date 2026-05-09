const bot = require('../../telegram/bot');
const { STATES, getSession, setState, updateData, clearSession } = require('../session');
const kb = require('../keyboards');
const collectionService = require('../../services/collectionService');
const movieService = require('../../services/movieService');

// Kolleksiyalar bo'limini ko'rsatish
async function startCollections(chatId, userId, msgId) {
  console.log(`📂 startCollections chaqirildi: userId=${userId}, msgId=${msgId}`);
  try {
    const configs = await collectionService.fetchCollectionsConfig();
    console.log(`📂 Kolleksiyalar yuklandi: ${configs.length} ta`);

    let text = `📂 *Kolleksiyalar boshqaruvi*\n\nJami: ${configs.length} ta\n\n`;
    
    if (configs.length === 0) {
      text += '⚠️ Hozircha hech qanday kolleksiya yaratilmagan.';
    } else {
      configs.forEach((col, i) => {
        text += `${i + 1}. *${col.title}*\n   Janrlar: ${col.genres.join(', ')}\n\n`;
      });
    }

    const options = {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown', reply_markup: kb.collectionsMainKeyboard(configs)
    };

    if (msgId) {
      await bot.editMessageText(text, options);
    } else {
      await bot.sendMessage(chatId, text, options);
    }
    console.log('📂 Kolleksiya menyusi ko\'rsatildi');
  } catch (err) {
    console.error('📂 Kolleksiya menyusi ko\'rsatishda xato:', err.message);
    await bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleCollectionsCallback(query, action) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const session = getSession(userId);

  if (action === 'col:add') {
    setState(userId, 'COL_ADD_TITLE', {});
    return bot.editMessageText('🆕 *Yangi kolleksiya*\n\nKolleksiya nomini yuboring:', {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.cancelKeyboard()
    });
  }

  if (action.startsWith('col:delete:')) {
    const colId = action.split(':')[2];
    const configs = await collectionService.fetchCollectionsConfig();
    const newConfigs = configs.filter(c => (c.id || c.title.toLowerCase().replace(/\s+/g, '_')) !== colId);
    await collectionService.saveCollectionsConfig(newConfigs);
    await bot.answerCallbackQuery(query.id, { text: '🗑️ O\'chirildi' });
    return startCollections(chatId, userId, msgId);
  }
}

async function handleCollectionsMessage(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const session = getSession(userId);
  const state = session.state;
  const data = session.data;

  if (state === 'COL_ADD_TITLE') {
    const title = msg.text?.trim();
    if (!title) return bot.sendMessage(chatId, '⚠️ Iltimos nomini yozing:');
    
    // Janrlarni tanlash uchun ro'yxatni olish
    const allMovies = await movieService.fetchAllMovies();
    const allGenres = [...new Set(allMovies.flatMap(m => m.genre || []))].sort();
    
    updateData(userId, { title, selectedGenres: [] });
    setState(userId, 'COL_ADD_GENRES', { title, selectedGenres: [], allGenres });
    
    return bot.sendMessage(chatId, 
      `📂 *${title}* kolleksiyasi uchun janrlarni tanlang:\n\n_Kamida bitta janr tanlang va "Tayyor" tugmasini bosing._`, 
      { parse_mode: 'Markdown', reply_markup: kb.genreSelectKeyboard(allGenres, []) }
    );
  }
}

// Janrlarni tanlash (callback)
async function handleGenreToggle(query, genre) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const session = getSession(userId);
  const data = session.data;

  let selected = data.selectedGenres || [];
  if (selected.includes(genre)) {
    selected = selected.filter(g => g !== genre);
  } else {
    selected.push(genre);
  }

  updateData(userId, { selectedGenres: selected });
  
  try {
    await bot.editMessageReplyMarkup(kb.genreSelectKeyboard(data.allGenres, selected), {
      chat_id: chatId, message_id: msgId
    });
  } catch (err) {
    // Message not modified
  }
}

async function finishCollectionAdd(query) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const session = getSession(userId);
  const data = session.data;

  if (!data.selectedGenres || data.selectedGenres.length === 0) {
    return bot.answerCallbackQuery(query.id, { text: '⚠️ Kamida bitta janr tanlang!', show_alert: true });
  }

  const configs = await collectionService.fetchCollectionsConfig();
  configs.push({
    id: data.title.toLowerCase().replace(/\s+/g, '_'),
    title: data.title,
    genres: data.selectedGenres
  });

  await collectionService.saveCollectionsConfig(configs);
  await bot.answerCallbackQuery(query.id, { text: '✅ Saqlandi' });
  clearSession(userId);
  return startCollections(chatId, userId, msgId);
}

module.exports = {
  startCollections,
  handleCollectionsCallback,
  handleCollectionsMessage,
  handleGenreToggle,
  finishCollectionAdd
};
