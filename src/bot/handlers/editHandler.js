const bot = require('../../telegram/bot');
const kb = require('../keyboards');
const { STATES, getSession, setState, updateData, clearSession } = require('../session');
const movieService = require('../../services/movieService');
const cache = require('../../services/cacheService');

// Tahrirlash menyusini ko'rsatish
async function showEditMenu(chatId, msgId, movieId) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return;

  const text = `✏️ *"${movie.title}"* ni tahrirlash\n\nQaysi maydonni o'zgartirmoqchisiz?`;
  try {
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.editFieldsKeyboard(movieId),
    });
  } catch {
    await bot.editMessageCaption(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown',
      reply_markup: kb.editFieldsKeyboard(movieId),
    });
  }
}

// Maydonga kirishni so'rash
async function askFieldValue(chatId, msgId, field, movieId, userId) {
  const labels = {
    title: "Yangi nomini yuboring:", original_title: "Yangi original nomini yuboring:",
    year: "Yangi yilini yuboring (masalan: 2024):",
    country: "Yangi davlatini yuboring (masalan: USA, Korea):",
    genre: "Yangi janrini yuboring (masalan: Action, Drama):",
    rating: "Yangi reytingini yuboring (1-10):",
    description: "Yangi tavsifini yuboring:",
  };

  // Tugmali maydonlar
  if (field === 'premiere') {
    return bot.editMessageText('🔥 Premyera statusini tanlang:', {
      chat_id: chatId, message_id: msgId,
      reply_markup: kb.editPremiereKeyboard(movieId),
    });
  }
  if (field === 'quality' || field.startsWith('quality')) {
    return bot.editMessageText('📺 Yangi sifatni tanlang:', {
      chat_id: chatId, message_id: msgId,
      reply_markup: kb.editQualityKeyboard(movieId),
    });
  }
  if (field === 'language' || field.startsWith('lang')) {
    return bot.editMessageText('🗣️ Yangi tilni tanlang:', {
      chat_id: chatId, message_id: msgId,
      reply_markup: kb.editLanguageKeyboard(movieId),
    });
  }
  if (field === 'exclusive') {
    return bot.editMessageText('💎 Eksklyuziv statusini tanlang:', {
      chat_id: chatId, message_id: msgId,
      reply_markup: kb.editExclusiveKeyboard(movieId),
    });
  }

  setState(userId, STATES.EDIT_FIELD_VALUE, { field, movieId });
  const label = labels[field] || `Yangi ${field} qiymatini yuboring:`;
  await bot.editMessageText(`✏️ ${label}`, {
    chat_id: chatId, message_id: msgId,
    reply_markup: kb.backToMenuKeyboard(),
  });
}

// Matnli edit qiymatini saqlash
async function saveEditValue(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const session = getSession(userId);
  if (session.state !== STATES.EDIT_FIELD_VALUE) return false;

  const { field, movieId } = session.data;
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return true;

  const transforms = {
    year: v => parseInt(v),
    rating: v => parseFloat(v),
    country: v => v.split(',').map(s => s.trim()),
    genre: v => v.split(',').map(s => s.trim()),
  };

  const value = transforms[field] ? transforms[field](msg.text) : msg.text;
  const updated = { ...movie, [field]: value };

  await movieService.updateMoviePost(movieId, updated);
  clearSession(userId);

  await bot.sendMessage(chatId,
    `✅ *${field}* yangilandi!`,
    { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
  );
  return true;
}

// Tugmali qiymatlarni saqlash (premiere, quality, language)
async function saveButtonEditValue(chatId, msgId, field, value, movieId) {
  const movie = await movieService.getMovieById(movieId);
  if (!movie) return;

  const langMap = {
    uzbek: "O'zbek tilida", russian: 'Rus tilida',
    original: 'Original', dubbed_uz: "Dublyaj (O'zbek)", dubbed_ru: 'Dublyaj (Rus)',
  };

  const updates = {
    premiere: { is_premiere: value === 'yes' },
    quality: { quality: value },
    lang: { language: langMap[value] || value },
    exclusive: { is_exclusive: value === 'yes' },
  };

  const updated = { ...movie, ...(updates[field] || {}) };
  await movieService.updateMoviePost(movieId, updated);

  await bot.editMessageText(
    `✅ Yangilandi!\n\n🎬 *${movie.title}*`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.editFieldsKeyboard(movieId) }
  );
}

module.exports = { showEditMenu, askFieldValue, saveEditValue, saveButtonEditValue };
