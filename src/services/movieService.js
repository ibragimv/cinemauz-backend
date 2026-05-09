const { getClient } = require('../telegram/client');
const cache = require('./cacheService');
const config = require('../config');

const CHANNEL_ID = config.CHANNEL_ID;
const META_TAG_NEW = '#CINEMA_META_DATA';
const META_TAG_OLD = '#CINEMA_META';

// Janrlarni normallashtirish xaritasi
const GENRE_MAP = {
  'dahshat': 'Qo\'rqinchli',
  'ilmiy fantastika': 'Fantastika',
  'ilmiy fantastik': 'Fantastika',
  'ilmiy fantastik va fantastika': 'Fantastika',
  'ilmiy-fantastika': 'Fantastika',
  'ilmiy-fantastik': 'Fantastika',
  'fantastika': 'Fantastika',
  'fantastic': 'Fantastika',
  'sci-fi': 'Fantastika',
  'harakat va sarguzasht': 'Sarguzasht',
  'harakat': 'Aktion',
  'thriller': 'Triller',
  'triller': 'Triller',
  'action': 'Aktion',
  'ekshn': 'Aktion',
  'crime': 'Kriminal',
  'jinoyat': 'Kriminal',
  'kriminal': 'Kriminal'
};

function normalizeGenres(genres) {
  if (!genres || !Array.isArray(genres)) return genres;
  
  const normalized = genres.map(g => {
    const raw = g.trim();
    const lower = raw.toLowerCase();
    
    // Agar matn ichida "fantastik" so'zi bo'lsa (masalan: "ilmiy fantastik va fantastika")
    if (lower.includes('fantastik') || lower.includes('fantastic')) {
      return 'Fantastika';
    }
    
    return GENRE_MAP[lower] || raw.charAt(0).toUpperCase() + raw.slice(1);
  });
  
  // Takroriy janrlarni o'chirish
  return [...new Set(normalized)];
}

const LANG_MAP = {
  'uzbek': 'O\'zbek tilida',
  'o\'zbek': 'O\'zbek tilida',
  'ozbek': 'O\'zbek tilida',
  'uzb': 'O\'zbek tilida',
  'rus': 'Rus tilida',
  'russian': 'Rus tilida'
};

function normalizeLanguage(lang) {
  if (!lang) return 'O\'zbek tilida'; // Default
  const lower = lang.toLowerCase().trim();
  return LANG_MAP[lower] || lang.trim().charAt(0).toUpperCase() + lang.trim().slice(1);
}

// Kanal xabarini movie obyektiga parse qilish
function parseMovieMetadata(message) {
  try {
    const text = message.message || message.caption || '';
    let jsonStr = '';

    if (text.includes(META_TAG_NEW)) {
      jsonStr = text.split(META_TAG_NEW)[1].trim();
    } else if (text.includes(META_TAG_OLD)) {
      jsonStr = text.split(META_TAG_OLD)[1].trim();
    } else {
      return null;
    }
    
    const data = JSON.parse(jsonStr);
    
    // Janrlarni normallashtirish
    if (data.genre) {
      data.genre = normalizeGenres(Array.isArray(data.genre) ? data.genre : [data.genre]);
    }

    // Tilni normallashtirish
    data.language = normalizeLanguage(data.language);
    
    // Poster va Backdrop rasmlarini to'liq URLga aylantirish
    if (data.tmdb_poster) {
        data.poster_path = `https://image.tmdb.org/t/p/original${data.tmdb_poster}`;
    }
    if (data.tmdb_backdrop) {
        data.backdrop = `https://image.tmdb.org/t/p/original${data.tmdb_backdrop}`;
        data.backdrop_path = data.tmdb_backdrop;
    }
    if (data.cast) {
        data.cast = data.cast.map(c => ({
            ...c,
            profile_path: c.img ? `https://image.tmdb.org/t/p/w500${c.img}` : null
        }));
    }

    const result = {
      ...data,
      type: data.type || 'movie', // Default movie agar bo'lmasa
      id: data.id?.toString() || message.id.toString()
    };

    if (data.seasons && data.seasons.length > 0) result.seasons = data.seasons;
    if (data.parts && data.parts.length > 0) result.parts = data.parts;

    return result;
  } catch (err) {
    return null;
  }
}

// Barcha kinolarni kanaldan olish
async function fetchAllMovies() {
  const cached = await cache.get(cache.KEYS.MOVIES_ALL);
  if (cached) return cached;

  const client = await getClient();
  const moviesMap = new Map();
  let offsetId = 0;

  while (true) {
    const messages = await client.getMessages(CHANNEL_ID, {
      limit: 100,
      offsetId,
    });

    if (!messages || messages.length === 0) break;

    // Eng yangi ma'lumotlar eskisini overwrite qilishi uchun teskari tartibda o'qiymiz
    for (const msg of [...messages].reverse()) {
      const meta = parseMovieMetadata(msg);
      
      if (meta) {
        // 1. Agar bu metadata bo'lsa
        const replyToId = msg.replyTo?.replyToMsgId;
        const id = meta.id || replyToId?.toString() || msg.id.toString();
        
        const existing = moviesMap.get(id) || {};
        moviesMap.set(id, { 
            ...existing, 
            ...meta, 
            id, 
            meta_msg_id: msg.id,
            poster_msg_id: existing.poster_msg_id || (msg.media ? msg.id.toString() : replyToId?.toString())
        });
      } else if (msg.media) {
        // 2. Agar bu metadata bo'lmasa lekin media bo'lsa (Poster yoki Video)
        const id = msg.id.toString();
        
        if (!moviesMap.has(id)) {
            moviesMap.set(id, { id, poster_msg_id: msg.id });
        } else {
            const existing = moviesMap.get(id);
            moviesMap.set(id, { ...existing, poster_msg_id: msg.id });
        }
      }
    }

    offsetId = messages[messages.length - 1].id;
    if (messages.length < 100) break;
  }

  const movies = Array.from(moviesMap.values())
    .filter(m => m.poster_msg_id && m.title)
    .map(m => ({
      ...m,
      seasons: m.seasons || [],
      parts: m.parts || [],
      is_exclusive: m.is_exclusive === true || m.is_exclusive === 'true',
      is_premiere: m.is_premiere === true || m.is_premiere === 'true'
    }))
    .sort((a, b) => b.poster_msg_id - a.poster_msg_id);

  await cache.set(cache.KEYS.MOVIES_ALL, movies, cache.TTL.MOVIES_ALL);
  return movies;
}

// ID bo'yicha bitta kino
async function getMovieById(id) {
  const cached = await cache.get(cache.KEYS.MOVIE(id));
  if (cached) return cached;

  const all = await fetchAllMovies();
  const movie = all.find(m => m.id === id);
  
  if (movie) await cache.set(cache.KEYS.MOVIE(id), movie, cache.TTL.MOVIE);
  return movie;
}

// Davlat nomlarini normallashtirish
function normalizeCountry(name) {
  if (!name) return name;
  const c = name.trim().toLowerCase();
  const usaVariants = ['aqsh', 'amerika', 'usa', 'united states', 'united states of america', 'amerika qo\'shma shtatlari', 'us'];
  if (usaVariants.includes(c)) return 'AQSH';
  
  // Birinchi harfni katta qilish (faqat ko'rsatish uchun)
  return name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
}

// Filterlash va qidiruv
function filterMovies(movies, { q, genre, year, country, actor, type, is_premiere, is_exclusive, sort, order, page = 0, limit = 20 }) {
  let result = [...movies];

  if (type) {
    if (type === 'cartoon') {
      const cartoonGenres = ['multfilm', 'animatsiya'];
      result = result.filter(m => 
        m.genre?.some(g => cartoonGenres.includes(g.toLowerCase()))
      );
    } else {
      result = result.filter(m => m.type === type);
    }
  }

  if (country) {
    const searchCountries = country.split(',').map(c => c.trim().toLowerCase());
    result = result.filter(m => {
        const movieCountries = (m.country || []).map(c => normalizeCountry(c).toLowerCase());
        return searchCountries.some(sc => movieCountries.includes(sc));
    });
  }

  if (q) {
    const query = q.toLowerCase();
    result = result.filter(m =>
      m.title?.toLowerCase().includes(query) ||
      m.original_title?.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.cast?.some(c => c.name.toLowerCase().includes(query))
    );
  }

  if (actor) {
    const actorName = actor.toLowerCase();
    result = result.filter(m =>
      m.cast?.some(c => c.name.toLowerCase().includes(actorName))
    );
  }

  if (genre) {
    const genres = genre.split(',').map(g => g.trim().toLowerCase());
    result = result.filter(m =>
      m.genre?.some(g => genres.includes(g.toLowerCase()))
    );
  }

  if (year) {
    result = result.filter(m => m.year === parseInt(year));
  }

  if (is_premiere !== undefined) {
    const premiere = is_premiere === 'true' || is_premiere === true;
    result = result.filter(m => m.is_premiere === premiere);
  }

  if (is_exclusive === 'true' || is_exclusive === true) {
    result = result.filter(m => m.is_exclusive === true || m.is_exclusive === 'true');
  } else if (is_exclusive === 'false' || is_exclusive === false) {
    result = result.filter(m => m.is_exclusive !== true && m.is_exclusive !== 'true');
  }

  // Saralash
  if (sort) {
    result.sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1;
      if (sort === 'rating') return (a.rating - b.rating) * dir;
      if (sort === 'year') return (a.year - b.year) * dir;
      if (sort === 'title') return a.title.localeCompare(b.title) * dir;
      return 0;
    });
  }

  const total = result.length;
  const start = parseInt(page) * parseInt(limit);
  const items = result.slice(start, start + parseInt(limit));

  return { items, total, page: parseInt(page), limit: parseInt(limit) };
}

// Kino metadata kanalga yuborish (bot yuboradi)
async function buildMetaCaption(movie) {
  const isSeries = movie.type === 'series';
  const emoji = movie.is_exclusive ? '💎' : (isSeries ? '📺' : '🎬');

  // Ko'rinadigan qism (Poster ostida)
  const lines = [
    `${emoji} *${movie.title}*`,
    movie.original_title ? `📽 ${movie.original_title}` : '',
    `📅 Yili: ${movie.year || 'N/A'}`,
    `🌍 Davlati: ${Array.isArray(movie.country) ? movie.country.join(', ') : movie.country || 'N/A'}`,
    `🎭 Janri: ${Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre || 'N/A'}`,
    `⭐ Reyting: ${movie.rating || 'N/A'}`,
    `🗣️ Tili: ${movie.language || 'O\'zbekcha'}`,
    `📺 Sifati: ${movie.quality || 'HD'}`,
    movie.is_exclusive ? `💎 *Eksklyuziv kontent*` : '',
  ];

  if (isSeries) {
    const season = movie.seasons?.[0];
    if (season) {
      lines.push(`📅 Fasli: ${season.num}`);
      lines.push(`📼 Qismlar: ${season.episodes?.length} ta`);
    }
  } else {
    lines.push(`⏱ Davomiyligi: ${movie.duration || 'N/A'} daqiqa`);
  }

  lines.push('');
  if (movie.description) {
    lines.push(movie.description.length > 500 ? movie.description.substring(0, 500) + '...' : movie.description);
  }

  lines.push('');
  lines.push(movie.id ? `#${isSeries ? 'SERIES' : 'MOVIE'}_ID_${movie.id}` : '');

  const caption = lines.filter(Boolean).join('\n');

  // Yashirin Metadata (Alohida xabarda)
  const metadata = `${META_TAG_NEW}\n${JSON.stringify({
    ...movie,
    id: movie.id?.toString()
  })}`;

  return { caption, metadata };
}

// Kinoni kanaldan o'chirish
async function deleteMovieMessages(movie) {
  const client = await getClient();
  const ids = [parseInt(movie.poster_msg_id)];
  if (movie.meta_msg_id) ids.push(parseInt(movie.meta_msg_id));
  
  if (movie.parts) {
    movie.parts.forEach(p => {
      if (p.channel_msg_id) ids.push(parseInt(p.channel_msg_id));
    });
  }
  await client.deleteMessages(CHANNEL_ID, ids.filter(Boolean).map(id => parseInt(id)), { revoke: true });
  await cache.invalidateAll();
}

// Metadata postini yangilash (edit)
async function updateMoviePost(movieId, updatedData) {
  const client = await getClient();
  const { metadata } = await buildMetaCaption(updatedData);
  
  // Metadata xabari ID sini aniqlash
  const targetMsgId = updatedData.meta_msg_id || movieId;

  await client.editMessage(CHANNEL_ID, {
    message: parseInt(targetMsgId),
    text: metadata,
  });
  await cache.invalidateAll();
}

// Statistika
async function getStats() {
  const movies = await fetchAllMovies();
  const total = movies.length;
  const premieres = movies.filter(m => m.is_premiere).length;
  const genres = {};
  movies.forEach(m => {
    (m.genre || []).forEach(g => {
      genres[g] = (genres[g] || 0) + 1;
    });
  });
  const topGenre = Object.entries(genres).sort((a, b) => b[1] - a[1])[0];
  return { total, premieres, topGenre: topGenre ? topGenre[0] : 'N/A' };
}

// Kolleksiyalar bo'yicha guruhlash
async function getCollections() {
  const allMovies = await fetchAllMovies();
  const collectionService = require('./collectionService');
  const config = await collectionService.fetchCollectionsConfig();

  // Agar konfiguratsiya bo'lmasa, bo'sh qaytarish (yoki default)
  if (!config || config.length === 0) {
    return [
        { id: 'latest', title: 'Eng yangilari', items: allMovies.slice(0, 10) }
    ];
  }

  return config.map(col => {
    // Konfiguratsiyadagi janrlarni normallashtirib olamiz
    const searchGenres = col.genres.map(g => {
        const lower = g.toLowerCase().trim();
        return GENRE_MAP[lower] || g;
    });

    const items = allMovies.filter(m => 
      m.genre?.some(g => searchGenres.includes(g))
    ).slice(0, 15);

    return {
      id: col.id || col.title.toLowerCase().replace(/\s+/g, '_'),
      title: col.title,
      items
    };
  });
}

// Qidiruvlarni hisoblash (in-memory, real loyihada Redis yoki DB bo'lishi kerak)
const searchCounts = new Map();

function recordMovieSearch(movieId) {
  if (!movieId) return;
  const id = movieId.toString();
  searchCounts.set(id, (searchCounts.get(id) || 0) + 1);
}

async function getTrendingMovies() {
  const allMovies = await fetchAllMovies();
  
  // Eng ko'p qidirilgan ID larni saralash
  const sortedIds = Array.from(searchCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);

  let trending = allMovies.filter(m => sortedIds.includes(m.id.toString()));

  // Agar qidiruvlar hali bo'lmasa, eng yangi 3 ta kinoni qaytarish
  if (trending.length < 3) {
    const remaining = allMovies
      .filter(m => !sortedIds.includes(m.id.toString()))
      .slice(0, 3 - trending.length);
    trending = [...trending, ...remaining];
  }

  return trending;
}

async function getRelatedMovies(movieId) {
  const allMovies = await fetchAllMovies();
  const currentMovie = allMovies.find(m => m.id.toString() === movieId.toString());
  
  if (!currentMovie || !currentMovie.genre) return [];

  const currentGenres = new Set(currentMovie.genre.map(g => g.toLowerCase()));

  const related = allMovies
    .filter(m => m.id.toString() !== movieId.toString()) // Joriy kinoni chiqarib tashlash
    .map(m => {
      const commonGenres = (m.genre || []).filter(g => currentGenres.has(g.toLowerCase()));
      return { ...m, commonCount: commonGenres.length };
    })
    .filter(m => m.commonCount > 0) // Kamida bitta janr to'g'ri kelsin
    .sort((a, b) => b.commonCount - a.commonCount || b.rating - a.rating) // Ko'proq mos keladiganlar birinchi, keyin reyting
    .slice(0, 10);

  return related;
}

module.exports = {
  fetchAllMovies,
  getMovieById,
  filterMovies,
  buildMetaCaption,
  deleteMovieMessages,
  updateMoviePost,
  getStats,
  getCollections,
  recordMovieSearch,
  getTrendingMovies,
  getRelatedMovies,
  normalizeCountry,
  META_TAG: META_TAG_NEW,
};
