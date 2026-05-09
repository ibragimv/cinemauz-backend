const express = require('express');
const router = express.Router();
const movieService = require('../services/movieService');
const { getClient } = require('../telegram/client');
const config = require('../config');

// GET /api/movies/:id/poster — posterIni serve qilish
router.get('/:id/poster', async (req, res) => {
  try {
    const msgId = parseInt(req.params.id);

    // Cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');

    const client = await getClient();
    const msgs = await client.getMessages(config.CHANNEL_ID, {
      ids: [msgId],
    });
    const msg = msgs[0];

    if (!msg || !msg.photo) {
      // Fallback - placeholder SVG qaytarish
      return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e"/>
            <stop offset="100%" style="stop-color:#0c0c1a"/>
          </linearGradient>
        </defs>
        <rect width="300" height="450" fill="url(#bg)"/>
        <circle cx="150" cy="180" r="40" fill="#7c3aed" opacity="0.3"/>
        <path d="M150 155 L165 185 L150 175 L135 185 Z" fill="#a78bfa"/>
        <rect x="130" y="195" width="40" height="50" rx="4" fill="#7c3aed" opacity="0.5"/>
        <text x="150" y="380" text-anchor="middle" fill="#7c3aed" font-size="16" font-family="sans-serif">Poster mavjud emas</text>
      </svg>`);
    }

    const buffer = await client.downloadMedia(msg, { thumb: 1 });

    if (!buffer || buffer.length === 0) {
      return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
        <rect width="300" height="450" fill="#1a1a2e"/>
        <text x="150" y="220" text-anchor="middle" fill="#7c3aed" font-size="48">🎬</text>
      </svg>`);
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (err) {
    console.error('Poster xatosi:', err.message);
    // Xato bo'lsa ham placeholder qaytarish
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
      <rect width="300" height="450" fill="#1a1a2e"/>
      <text x="150" y="220" text-anchor="middle" fill="#7c3aed" font-size="48">🎬</text>
    </svg>`);
  }
});
// GET /api/movies/:id/backdrop — backdropini serve qilish
router.get('/:id/backdrop', async (req, res) => {
  try {
    const movie = await movieService.getMovieById(req.params.id);
    if (!movie || (!movie.backdrop && !movie.backdrop_path)) {
      // Posterga redirect qilish yoki placeholder
      return res.redirect(`/api/movies/${req.params.id}/poster`);
    }

    // Agar backendda to'liq backdrop URL bo'lsa (TMDB), o'shani redirect qilishi mumkin yoki serve qilishi mumkin
    // Hozircha TMDB URL'ga redirect qilamiz (backend keshlaydigan bo'lguncha)
    const backdropUrl = movie.backdrop || (movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null);
    
    if (backdropUrl) {
      return res.redirect(backdropUrl);
    }
    
    res.redirect(`/api/movies/${req.params.id}/poster`);
  } catch (err) {
    res.redirect(`/api/movies/${req.params.id}/poster`);
  }
});

// GET /api/movies — ro'yxat + filter
router.get('/', async (req, res) => {
  try {
    const allMovies = await movieService.fetchAllMovies();
    const { q, genre, year, country, actor, type, is_premiere, is_exclusive, sort, order, page = 0, limit = 20 } = req.query;

    const result = movieService.filterMovies(allMovies, {
      q, genre, year, country, actor, type, is_premiere, is_exclusive, sort, order, page, limit,
    });

    // To'liq ma'lumotni qaytarish (cast bilan birga)
    const fullData = result.items.map(m => ({
      ...m,
      cast: m.cast || []
    }));

    // Qidiruvlarni qayd etish
    if (q && fullData.length > 0) {
      fullData.slice(0, 3).forEach(m => movieService.recordMovieSearch(m.id));
    }

    res.json({
      success: true,
      data: fullData,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/search — qidiruv
router.get('/search', async (req, res) => {
  try {
    const { q, genre, year, country, actor, type, is_premiere, sort, order, page = 0, limit = 20 } = req.query;
    const result = movieService.filterMovies(allMovies, {
      q, genre, year, country, actor, type, is_premiere, sort, order, page, limit,
    });

    // To'liq ma'lumotni qaytarish (cast bilan birga)
    const fullData = result.items.map(m => ({
      ...m,
      cast: m.cast || []
    }));

    // Qidiruvlarni qayd etish
    if (q && fullData.length > 0) {
      fullData.slice(0, 3).forEach(m => movieService.recordMovieSearch(m.id));
    }

    res.json({
      success: true,
      data: fullData,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
        query: { q, genre, year, country, is_premiere },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/collections — guruhlangan kinolar (Home uchun)
router.get('/collections', async (req, res) => {
  try {
    const collections = await movieService.getCollections();
    
    // Summary format for collections
    const summaryCollections = collections.map(col => ({
      id: col.id,
      title: col.title,
      items: (col.items || []).map(m => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        backdrop: m.backdrop,
        year: m.year,
        genre: m.genre,
        rating: m.rating,
        quality: m.quality,
        is_premiere: m.is_premiere
      }))
    }));

    res.json({ success: true, data: summaryCollections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/trending-weekly — haftalik trend kinolar
router.get('/trending-weekly', async (req, res) => {
  try {
    const trending = await movieService.getTrendingMovies();
    
    // Card formatiga moslab qaytarish
    const formattedData = trending.map(m => ({
      id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      backdrop: m.backdrop,
      year: m.year,
      genre: m.genre,
      rating: m.rating,
      quality: m.quality,
      is_premiere: m.is_premiere
    }));

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/filters — mavjud filter qiymatlari
router.get('/filters', async (req, res) => {
  try {
    const movies = await movieService.fetchAllMovies();

    const genres = [...new Set(movies.flatMap(m => m.genre || []))].sort();
    const years = [...new Set(movies.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
    const countries = [...new Set(movies.flatMap(m => m.country || []).map(movieService.normalizeCountry))].sort();
    const languages = [...new Set(movies.map(m => m.language).filter(Boolean))].sort();
    const qualities = [...new Set(movies.map(m => m.quality).filter(Boolean))];

    res.json({ success: true, data: { genres, years, countries, languages, qualities } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/:id/related — o'xshash kinolar
router.get('/:id/related', async (req, res) => {
  try {
    const related = await movieService.getRelatedMovies(req.params.id);
    
    // Card formatiga moslash
    const formatted = related.map(m => ({
      id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      backdrop: m.backdrop,
      year: m.year,
      genre: m.genre,
      rating: m.rating,
      quality: m.quality,
      is_premiere: m.is_premiere
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/:id — bitta kino
router.get('/:id', async (req, res) => {
  try {
    const movie = await movieService.getMovieById(req.params.id);
    if (!movie) return res.status(404).json({ success: false, error: 'Kino topilmadi' });
    res.json({ success: true, data: movie });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
