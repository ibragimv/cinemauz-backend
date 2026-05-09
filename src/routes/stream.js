const express = require('express');
const router = express.Router();
const movieService = require('../services/movieService');
const { streamMovie, getTotalSize } = require('../services/streamService');

// GET /stream/:id — video stream (Range request bilan)
router.get('/:id', async (req, res) => {
  try {
    const movie = await movieService.getMovieById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });

    let parts = movie.parts || [];

    // Seriallar uchun epizod mantiqi
    if (parts.length === 0 && movie.type === 'series') {
      const seasonNum = parseInt(req.query.s) || (movie.seasons?.[0]?.num);
      const episodeNum = parseInt(req.query.e) || 1;

      console.log(`🎬 Stream so'rovi: Serial="${movie.title}", S=${seasonNum}, E=${episodeNum}`);

      if (seasonNum) {
        const season = movie.seasons?.find(s => s.num == seasonNum);
        const episode = season?.episodes?.find(ep => ep.ep == episodeNum);

        if (episode) {
          const fileId = episode.msg_id || episode.file_id || episode.fileId;
          console.log(`✅ Epizod topildi: MsgID=${fileId}, Hajm=${episode.size}`);
          
          parts = [{ 
            channel_msg_id: fileId, 
            size: Number(episode.size || 0) 
          }];
        } else {
          console.log(`❌ Epizod topilmadi: S=${seasonNum}, E=${episodeNum}`);
        }
      }
    }

    if (parts.length === 0) {
      console.log(`❌ Stream xatosi: "${movie.title}" uchun video fayl topilmadi`);
      return res.status(404).json({ error: 'Video fayl topilmadi' });
    }

    const totalSize = getTotalSize(parts);
    const range = req.headers.range;

    let start = 0;
    let end = totalSize - 1;

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1]);
        end = match[2] ? parseInt(match[2]) : totalSize - 1;
      }
    }

    // Oraliqni cheklash
    end = Math.min(end, totalSize - 1);
    if (start > end) {
      return res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
    }

    // CORS va Range Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    // Agar Range header yo'q bo'lsa, to'liq fayl
    if (!range) {
      res.setHeader('Content-Length', totalSize);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      start = 0;
      end = totalSize - 1;
    }

    await streamMovie(movie, start, end, res, parts);
  } catch (err) {
    console.error('Stream xatosi:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// GET /stream/:id/info — fayl ma'lumotlari
router.get('/:id/info', async (req, res) => {
  try {
    const movie = await movieService.getMovieById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });

    const totalSize = getTotalSize(movie.parts || []);
    res.json({
      success: true,
      data: {
        id: movie.id,
        title: movie.title,
        total_size: totalSize,
        parts_count: (movie.parts || []).length,
        quality: movie.quality,
        duration: movie.duration,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
