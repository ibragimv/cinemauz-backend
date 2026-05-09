// ─── MAIN MENU ─────────────────────────────────────────────────────────────
const mainMenu = () => ({
  inline_keyboard: [
    [{ text: '➕ Kino qo\'shish', callback_data: 'upload:start' }],
    [{ text: '📂 Kolleksiyalar', callback_data: 'col:main' }],
    [{ text: '🎞 Kinolar ro\'yxati', callback_data: 'movies:list:0' }],
    [{ text: '💎 Eksklyuziv', callback_data: 'movies:exclusive:0' }],
    [{ text: '🔍 Qidiruv', callback_data: 'search:start' }, { text: '📊 Statistika', callback_data: 'stats:show' }],
    [{ text: '👥 Foydalanuvchilar', callback_data: 'users:stats' }, { text: '🔔 Bildirishnoma', callback_data: 'notif:start' }],
  ],
});

const collectionsMainKeyboard = (configs) => {
  const kb = configs.map(c => [
    { text: `🗑️ ${c.title}`, callback_data: `col:delete:${c.id || c.title.toLowerCase().replace(/\s+/g, '_')}` }
  ]);
  kb.push([{ text: '➕ Yangi qo\'shish', callback_data: 'col:add' }]);
  kb.push([{ text: '🔙 Orqaga', callback_data: 'main_menu' }]);
  return { inline_keyboard: kb };
};

const genreSelectKeyboard = (allGenres, selected) => {
  const rows = [];
  for (let i = 0; i < allGenres.length; i += 2) {
    const row = [];
    const g1 = allGenres[i];
    row.push({ text: `${selected.includes(g1) ? '✅ ' : ''}${g1}`, callback_data: `col:genre:toggle:${g1}` });
    if (allGenres[i + 1]) {
      const g2 = allGenres[i + 1];
      row.push({ text: `${selected.includes(g2) ? '✅ ' : ''}${g2}`, callback_data: `col:genre:toggle:${g2}` });
    }
    rows.push(row);
  }
  rows.push([{ text: '✅ Tayyor', callback_data: 'col:finish' }]);
  rows.push([{ text: '❌ Bekor qilish', callback_data: 'main_menu' }]);
  return { inline_keyboard: rows };
};

// ─── UPLOAD FLOW ────────────────────────────────────────────────────────────
const cancelKeyboard = () => ({
  inline_keyboard: [
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const uploadMethodsKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🎬 Kino (TMDB)', callback_data: 'upload:method:tmdb' }, { text: '📝 Kino (Qo\'lda)', callback_data: 'upload:method:manual' }],
    [{ text: '📺 Serial (TMDB)', callback_data: 'upload:series:tmdb' }, { text: '📝 Serial (Qo\'lda)', callback_data: 'upload:series:manual' }],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const seasonSelectKeyboard = (seasons) => {
  const kb = (seasons || []).map(s => [{ text: `${s.num}-fasl (${s.ep_count || s.episodes?.length || 0} qism)`, callback_data: `upload:series:season:${s.num}` }]);
  
  // Yangi fasl qo'shish tugmasi
  kb.push([{ text: '➕ Yangi fasl raqamini kiritish', callback_data: 'upload:series:new_season' }]);
  kb.push([{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }]);
  return { inline_keyboard: kb };
};

const episodePartsKeyboard = (epNum, partCount) => {
  const kb = [];
  if (partCount > 0) {
    kb.push([{ text: `✅ ${epNum}-qismni yakunlash`, callback_data: `upload:series:ep:done:${epNum}` }]);
  }
  kb.push([{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }]);
  return { inline_keyboard: kb };
};

const premiereKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '🔥 Ha, Premyera!', callback_data: 'upload:premiere:yes' },
      { text: '📽 Yo\'q', callback_data: 'upload:premiere:no' },
    ],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const exclusiveKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '💎 Ha, Eksklyuziv', callback_data: 'upload:exclusive:yes' },
      { text: '🔓 Yo\'q, Umumiy', callback_data: 'upload:exclusive:no' },
    ],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const qualityKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '📱 480p', callback_data: 'upload:quality:480p' },
      { text: '📺 720p', callback_data: 'upload:quality:720p' },
    ],
    [
      { text: '🖥 1080p', callback_data: 'upload:quality:1080p' },
      { text: '✨ 4K', callback_data: 'upload:quality:4K' },
    ],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const languageKeyboard = () => ({
  inline_keyboard: [
    [{ text: "🇺🇿 O'zbek tilida", callback_data: 'upload:lang:uzbek' }],
    [{ text: '🇷🇺 Rus tilida', callback_data: 'upload:lang:russian' }],
    [{ text: '🌍 Original', callback_data: 'upload:lang:original' }],
    [{ text: '🎙 Dublyaj (O\'zbek)', callback_data: 'upload:lang:dubbed_uz' }],
    [{ text: '🎙 Dublyaj (Rus)', callback_data: 'upload:lang:dubbed_ru' }],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ],
});

const videoPartsKeyboard = (count) => ({
  inline_keyboard: [
    count > 0
      ? [{ text: `✅ Tugatish (${count} ta qism yuklandi)`, callback_data: 'upload:video:done' }]
      : [],
    [{ text: '❌ Bekor qilish', callback_data: 'upload:cancel' }],
  ].filter(r => r.length > 0),
});

const confirmKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '✅ Saqlash', callback_data: 'upload:confirm:yes' },
      { text: '❌ Bekor qilish', callback_data: 'upload:cancel' },
    ],
  ],
});

// ─── MOVIE LIST ──────────────────────────────────────────────────────────────
const moviesListKeyboard = (movies, page, total, pageSize = 8) => {
  const totalPages = Math.ceil(total / pageSize);
  const buttons = movies.map(m => ([{
    text: `${m.is_premiere ? '🔥 ' : ''}${m.title} (${m.year}) ⭐${m.rating}`,
    callback_data: `movie:view:${m.id}:${page}`,
  }]));

  const navRow = [];
  if (page > 0) navRow.push({ text: '◀ Oldingi', callback_data: `movies:list:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages || 1}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Keyingi ▶', callback_data: `movies:list:${page + 1}` });

  if (navRow.length > 0) buttons.push(navRow);
  buttons.push([{ text: '🏠 Bosh menu', callback_data: 'menu:main' }]);

  return { inline_keyboard: buttons };
};

const exclusiveMoviesListKeyboard = (movies, page, total, pageSize = 8) => {
  const totalPages = Math.ceil(total / pageSize);
  const buttons = movies.map(m => ([{
    text: `💎 ${m.title} (${m.year}) ⭐${m.rating}`,
    callback_data: `movie:view:${m.id}:${page}:exclusive`,
  }]));

  const navRow = [];
  if (page > 0) navRow.push({ text: '◀ Oldingi', callback_data: `movies:exclusive:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages || 1}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Keyingi ▶', callback_data: `movies:exclusive:${page + 1}` });

  if (navRow.length > 0) buttons.push(navRow);
  buttons.push([{ text: '🏠 Bosh menu', callback_data: 'menu:main' }]);

  return { inline_keyboard: buttons };
};

// ─── MOVIE DETAIL ────────────────────────────────────────────────────────────
const movieDetailKeyboard = (movie, page = 0, isExclusive = false) => {
  const kb = [];
  const isSeries = movie.type === 'series';

  if (isSeries) {
    kb.push([{ text: '➕ Yangi fasl/qism qo\'shish', callback_data: `upload:add_season:${movie.id}` }]);
  }

  kb.push([
    { text: '✏️ Tahrirlash', callback_data: `edit:start:${movie.id}` },
    { text: '🗑 O\'chirish', callback_data: `delete:confirm:${movie.id}` }
  ]);
  
  kb.push([{ text: '🔔 Bildirishnoma bog\'lash', callback_data: `notif:movie:${movie.id}` }]);
  
  const backCallback = isExclusive ? `movies:exclusive:${page}` : `movies:list:${page}`;
  kb.push([{ text: '🔙 Ro\'yxatga qaytish', callback_data: backCallback }]);
  kb.push([{ text: '🏠 Bosh menu', callback_data: 'menu:main' }]);
  return { inline_keyboard: kb };
};

const deleteConfirmKeyboard = (movieId) => ({
  inline_keyboard: [
    [
      { text: '🗑 Ha, o\'chirish', callback_data: `delete:yes:${movieId}` },
      { text: '❌ Yo\'q', callback_data: `movie:view:${movieId}:0` },
    ],
  ],
});

// ─── EDIT ────────────────────────────────────────────────────────────────────
const editFieldsKeyboard = (movieId) => ({
  inline_keyboard: [
    [
      { text: '📝 Nom', callback_data: `edit:field:title:${movieId}` },
      { text: '📅 Yil', callback_data: `edit:field:year:${movieId}` },
    ],
    [
      { text: '⭐ Reyting', callback_data: `edit:field:rating:${movieId}` },
      { text: '🌍 Davlat', callback_data: `edit:field:country:${movieId}` },
    ],
    [
      { text: '🎭 Janr', callback_data: `edit:field:genre:${movieId}` },
      { text: '🔥 Premyera', callback_data: `edit:premiere:${movieId}` },
    ],
    [
      { text: '🗣 Til', callback_data: `edit:language:${movieId}` },
      { text: '📺 Sifat', callback_data: `edit:quality:${movieId}` },
    ],
    [
      { text: '💎 Eksklyuziv', callback_data: `edit:exclusive:${movieId}` },
    ],
    [{ text: '📝 Tavsif', callback_data: `edit:field:description:${movieId}` }],
    [{ text: '🔙 Orqaga', callback_data: `movie:view:${movieId}:0` }],
  ],
});

const editPremiereKeyboard = (movieId) => ({
  inline_keyboard: [
    [
      { text: '🔥 Ha, Premyera!', callback_data: `edit:set:premiere:yes:${movieId}` },
      { text: '📽 Yo\'q', callback_data: `edit:set:premiere:no:${movieId}` },
    ],
    [{ text: '🔙 Orqaga', callback_data: `edit:start:${movieId}` }],
  ],
});

const editQualityKeyboard = (movieId) => ({
  inline_keyboard: [
    [
      { text: '📱 480p', callback_data: `edit:set:quality:480p:${movieId}` },
      { text: '📺 720p', callback_data: `edit:set:quality:720p:${movieId}` },
    ],
    [
      { text: '🖥 1080p', callback_data: `edit:set:quality:1080p:${movieId}` },
      { text: '✨ 4K', callback_data: `edit:set:quality:4K:${movieId}` },
    ],
    [{ text: '🔙 Orqaga', callback_data: `edit:start:${movieId}` }],
  ],
});

const editLanguageKeyboard = (movieId) => ({
  inline_keyboard: [
    [{ text: "🇺🇿 O'zbek tilida", callback_data: `edit:set:lang:uzbek:${movieId}` }],
    [{ text: '🇷🇺 Rus tilida', callback_data: `edit:set:lang:russian:${movieId}` }],
    [{ text: '🌍 Original', callback_data: `edit:set:lang:original:${movieId}` }],
    [{ text: '🎙 Dublyaj (O\'zbek)', callback_data: `edit:set:lang:dubbed_uz:${movieId}` }],
    [{ text: '🎙 Dublyaj (Rus)', callback_data: `edit:set:lang:dubbed_ru:${movieId}` }],
    [{ text: '🔙 Orqaga', callback_data: `edit:start:${movieId}` }],
  ],
});

const editExclusiveKeyboard = (movieId) => ({
  inline_keyboard: [
    [
      { text: '💎 Ha, Eksklyuziv', callback_data: `edit:set:exclusive:yes:${movieId}` },
      { text: '🔓 Yo\'q, Umumiy', callback_data: `edit:set:exclusive:no:${movieId}` },
    ],
    [{ text: '🔙 Orqaga', callback_data: `edit:start:${movieId}` }],
  ],
});

const backToMenuKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🏠 Bosh menu', callback_data: 'menu:main' }],
  ],
});

module.exports = {
  mainMenu,
  cancelKeyboard,
  uploadMethodsKeyboard,
  premiereKeyboard,
  exclusiveKeyboard,
  qualityKeyboard,
  languageKeyboard,
  videoPartsKeyboard,
  confirmKeyboard,
  moviesListKeyboard,
  exclusiveMoviesListKeyboard,
  movieDetailKeyboard,
  deleteConfirmKeyboard,
  editFieldsKeyboard,
  editPremiereKeyboard,
  editQualityKeyboard,
  editLanguageKeyboard,
  editExclusiveKeyboard,
  backToMenuKeyboard,
  collectionsMainKeyboard,
  genreSelectKeyboard,
  seasonSelectKeyboard,
  episodePartsKeyboard,
};
