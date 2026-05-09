const axios = require('axios');
const config = require('../config');
const { translate } = require('google-translate-api-x');

const BASE_URL = 'https://api.themoviedb.org/3';

async function translateToUz(text) {
  if (!text) return '';
  try {
    const res = await translate(text, { to: 'uz' });
    return res.text;
  } catch (err) {
    console.error('Translation Error:', err.message);
    return text;
  }
}

async function getMovieDetails(id) {
  if (!config.TMDB_API_KEY) throw new Error('TMDB API Key topilmadi.');

  const isJwt = config.TMDB_API_KEY.length > 50;
  const headers = isJwt ? { Authorization: `Bearer ${config.TMDB_API_KEY}` } : {};
  const params = isJwt ? { language: 'uz-UZ', append_to_response: 'translations,release_dates,credits,videos,images' } 
                       : { api_key: config.TMDB_API_KEY, language: 'uz-UZ', append_to_response: 'translations,release_dates,credits,videos,images' };

  try {
    const response = await axios.get(`${BASE_URL}/movie/${id}`, { params, headers });
    const data = response.data;
    
    // Treylerni olish (YouTube Official Trailer)
    const videos = data.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
    const trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    // Fon rasmi va screenshotlarni olish
    const backdrop = data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null;
    const images = (data.images?.backdrops || []).slice(0, 5).map(img => `https://image.tmdb.org/t/p/original${img.file_path}`);

    let description = data.overview;
    if (!description) {
        const ruResponse = await axios.get(`${BASE_URL}/movie/${id}`, {
            params: { ...params, language: 'ru-RU' },
            headers
        });
        description = ruResponse.data.overview;
    }

    // Agar hali ham o'zbekcha bo'lmasa (TMDB uz-UZ ko'pincha bo'sh bo'ladi), tarjima qilish
    if (description && data.original_language !== 'uz') {
        description = await translateToUz(description);
    }

    // Janr va Davlatlarni tarjima qilish (agar TMDB o'zi qilmagan bo'lsa)
    const genre = await Promise.all((data.genres || []).map(async g => await translateToUz(g.name)));
    const country = await Promise.all((data.production_countries || []).map(async c => await translateToUz(c.name)));

    // Aktyorlar (Joyni tejash uchun faqat profil yo'lini saqlaymiz)
    const cast = (data.credits?.cast || []).slice(0, 10).map(c => ({
      name: c.name,
      char: c.character,
      img: c.profile_path, // To'liq URL emas, faqat yo'l
    }));

    return {
      title: data.title,
      original_title: data.original_title,
      year: data.release_date ? parseInt(data.release_date.split('-')[0]) : null,
      genre,
      country,
      rating: data.vote_average ? parseFloat(data.vote_average.toFixed(1)) : null,
      duration: data.runtime,
      description,
      poster_path: data.poster_path ? `https://image.tmdb.org/t/p/original${data.poster_path}` : null,
      tmdb_poster: data.poster_path,
      backdrop,
      images,
      trailer: trailer_url,
      cast,
    };
  } catch (err) {
    console.error('TMDB Error:', err.message);
    throw new Error('Kino ma\'lumotlarini olishda xatolik yuz berdi.');
  }
}

async function searchMovies(query) {
  if (!config.TMDB_API_KEY) throw new Error('TMDB API Key topilmadi.');

  const isJwt = config.TMDB_API_KEY.length > 50;
  const headers = isJwt ? { Authorization: `Bearer ${config.TMDB_API_KEY}` } : {};
  const params = isJwt ? { query, language: 'uz-UZ' } 
                       : { api_key: config.TMDB_API_KEY, query, language: 'uz-UZ' };

  try {
    const response = await axios.get(`${BASE_URL}/search/movie`, { params, headers });
    return response.data.results.map(m => ({
      id: m.id,
      title: m.title,
      original_title: m.original_title,
      year: m.release_date ? parseInt(m.release_date.split('-')[0]) : null,
      rating: m.vote_average,
      poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      description: m.overview
    })).slice(0, 10);
  } catch (err) {
    console.error('TMDB Search Error:', err.message);
    return [];
  }
}

async function getSeriesDetails(id) {
  if (!config.TMDB_API_KEY) throw new Error('TMDB API Key topilmadi.');

  const isJwt = config.TMDB_API_KEY.length > 50;
  const headers = isJwt ? { Authorization: `Bearer ${config.TMDB_API_KEY}` } : {};
  const params = isJwt ? { language: 'uz-UZ', append_to_response: 'credits,videos,images' } 
                       : { api_key: config.TMDB_API_KEY, language: 'uz-UZ', append_to_response: 'credits,videos,images' };

  try {
    const response = await axios.get(`${BASE_URL}/tv/${id}`, { params, headers });
    const data = response.data;
    
    // Treylerni olish (YouTube Official Trailer)
    const videos = data.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
    const trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    const backdrop = data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null;
    const images = (data.images?.backdrops || []).slice(0, 5).map(img => `https://image.tmdb.org/t/p/original${img.file_path}`);

    let description = data.overview;
    if (!description) {
        const ruResponse = await axios.get(`${BASE_URL}/tv/${id}`, { params: { ...params, language: 'ru-RU' }, headers });
        description = ruResponse.data.overview;
    }
    if (description && data.original_language !== 'uz') description = await translateToUz(description);

    const genre = await Promise.all((data.genres || []).map(async g => await translateToUz(g.name)));
    const country = await Promise.all((data.origin_country || []).map(async c => await translateToUz(c)));

    const cast = (data.credits?.cast || []).slice(0, 10).map(c => ({
      name: c.name, char: c.character, img: c.profile_path,
    }));

    return {
      type: 'series',
      title: data.name,
      original_title: data.original_name,
      year: data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : null,
      genre,
      country,
      rating: data.vote_average ? parseFloat(data.vote_average.toFixed(1)) : null,
      description,
      poster_path: data.poster_path ? `https://image.tmdb.org/t/p/original${data.poster_path}` : null,
      tmdb_poster: data.poster_path,
      backdrop,
      images,
      trailer: trailer_url,
      cast,
      total_seasons: data.number_of_seasons,
      seasons: (data.seasons || []).filter(s => s.season_number > 0).map(s => ({
        num: s.season_number,
        ep_count: s.episode_count,
        name: s.name
      }))
    };
  } catch (err) {
    console.error('TMDB Series Error:', err.message);
    throw new Error('Serial ma\'lumotlarini olishda xatolik.');
  }
}

async function searchSeries(query) {
  if (!config.TMDB_API_KEY) throw new Error('TMDB API Key topilmadi.');

  const isJwt = config.TMDB_API_KEY.length > 50;
  const headers = isJwt ? { Authorization: `Bearer ${config.TMDB_API_KEY}` } : {};
  const params = isJwt ? { query, language: 'uz-UZ' } 
                       : { api_key: config.TMDB_API_KEY, query, language: 'uz-UZ' };

  try {
    const response = await axios.get(`${BASE_URL}/search/tv`, { params, headers });
    return response.data.results.map(m => ({
      id: m.id,
      title: m.name,
      original_title: m.original_name,
      year: m.first_air_date ? parseInt(m.first_air_date.split('-')[0]) : null,
      rating: m.vote_average,
      poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      description: m.overview
    })).slice(0, 10);
  } catch (err) {
    console.error('TMDB Series Search Error:', err.message);
    return [];
  }
}

module.exports = {
  getMovieDetails,
  searchMovies,
  getSeriesDetails,
  searchSeries,
};
