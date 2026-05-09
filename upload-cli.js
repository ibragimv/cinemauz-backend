/**
 * CLI Upload Script — 2GB+ fayllar uchun
 * Ishlatish:
 *   node upload-cli.js --file="kino.mp4" --title="Film nomi" --year=2024 --genre="Action,Drama" --country="USA" --rating=8.5 --lang="O'zbek tilida" --quality="1080p" --duration=120 --desc="Tavsif" --poster="poster.jpg"
 *
 * Yoki interaktiv rejimda:
 *   node upload-cli.js
 */

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const config = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  session: process.env.TELEGRAM_SESSION || '',
  channelId: process.env.CHANNEL_ID,
};

const CHUNK_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const META_TAG = '#CINEMA_META';

// ─── ARGUMENT PARSER ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, ...rest] = arg.replace('--', '').split('=');
    args[key] = rest.join('=');
  });
  return args;
}

// ─── READLINE HELPER ──────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
function printProgress(label, current, total) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round(pct / 2);
  const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);
  process.stdout.write(`\r${label}: [${bar}] ${pct}% (${formatSize(current)}/${formatSize(total)})`);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes > 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  return bytes + ' B';
}

// ─── FAYL BO'LISH VA YUKLASH ──────────────────────────────────────────────────
async function uploadFileInChunks(client, filePath, channelEntity) {
  const fileSize = fs.statSync(filePath).size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const parts = [];

  console.log(`\n📦 Fayl hajmi: ${formatSize(fileSize)}`);
  console.log(`✂️  Bo'linadi: ${totalChunks} qism (har biri max 1.5GB)\n`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunkSize = end - start;

    console.log(`\n📤 ${i + 1}/${totalChunks} qism yuklanmoqda (${formatSize(chunkSize)})...`);

    // Chunk ni o'qish
    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, chunkSize, start);
    fs.closeSync(fd);

    // Progress bilan yuklash
    let uploaded = 0;
    const sent = await client.sendFile(channelEntity, {
      file: buffer,
      forceDocument: true,
      fileName: `${path.basename(filePath, path.extname(filePath))}_part${i + 1}.mp4`,
      caption: '',
      progressCallback: (progress) => {
        uploaded = progress * chunkSize;
        printProgress(`  Qism ${i + 1}`, uploaded, chunkSize);
      },
    });

    process.stdout.write('\n');
    console.log(`  ✅ Qism ${i + 1} yuklandi! (Message ID: ${sent.id})`);

    parts.push({
      index: i,
      channel_msg_id: sent.id,
      size: chunkSize,
    });
  }

  return parts;
}

// ─── POSTER YUKLASH ───────────────────────────────────────────────────────────
async function uploadPosterAndMeta(client, channelEntity, posterPath, metadata) {
  const caption = `${META_TAG}\n${JSON.stringify(metadata)}`;

  let posterBuffer;
  if (posterPath && fs.existsSync(posterPath)) {
    posterBuffer = fs.readFileSync(posterPath);
  } else {
    // Poster yo'q bo'lsa — default placeholder
    console.log('⚠️  Poster topilmadi, metadata matn sifatida yuklanadi');
    const textMsg = await client.sendMessage(channelEntity, { message: caption });
    return textMsg.id;
  }

  const sent = await client.sendFile(channelEntity, {
    file: posterBuffer,
    caption: caption,
    forceDocument: false,
  });

  return sent.id;
}

// ─── ASOSIY FUNKSIYA ──────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 Cinema CLI Upload Tool\n');

  const client = new TelegramClient(
    new StringSession(config.session),
    config.apiId,
    config.apiHash,
    { connectionRetries: 5 }
  );

  await client.connect();
  console.log('✅ Telegram\'ga ulandi\n');

  const channelEntity = await client.getEntity(config.channelId);

  // Argumentlarni olish yoki interaktiv so'rash
  let args = parseArgs();

  const getArg = async (key, prompt, required = true) => {
    if (args[key]) return args[key];
    const val = await ask(prompt);
    if (required && !val.trim()) {
      console.log(`❌ ${key} majburiy!`);
      process.exit(1);
    }
    return val.trim();
  };

  const filePath = await getArg('file', '🎬 Video fayl yo\'li (masalan: /home/user/kino.mp4): ');
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Fayl topilmadi: ${filePath}`);
    process.exit(1);
  }

  const title        = await getArg('title',    "📝 Kino nomi (O'zbek): ");
  const origTitle    = await getArg('original', '📝 Original nomi: ', false) || title;
  const year         = parseInt(await getArg('year',     '📅 Yil (masalan: 2024): '));
  const countryStr   = await getArg('country',  '🌍 Davlat (masalan: USA, Korea): ');
  const genreStr     = await getArg('genre',    '🎭 Janr (masalan: Action, Drama): ');
  const rating       = parseFloat(await getArg('rating', '⭐ Reyting (1-10): '));
  const isPremiere   = (await getArg('premiere', '🔥 Premyera? (ha/yoq): ', false)).toLowerCase() === 'ha';
  const language     = await getArg('lang',     "🗣️ Til (masalan: O'zbek tilida): ");
  const quality      = await getArg('quality',  '📺 Sifat (masalan: 1080p): ');
  const duration     = parseInt(await getArg('duration', '⏱️ Davomiylik (daqiqada): '));
  const description  = await getArg('desc',     '📝 Tavsif: ', false) || '';
  const posterPath   = await getArg('poster',   '🖼️ Poster fayl yo\'li (bo\'sh qoldirsa o\'tkaziladi): ', false) || '';

  rl.close();

  // Video yuklash
  console.log('\n═══════════════════════════════════════');
  console.log('📤 Video yuklanmoqda...');
  const parts = await uploadFileInChunks(client, filePath, channelEntity);

  // Metadata yaratish
  const totalSize = fs.statSync(filePath).size;
  const metadata = {
    title,
    original_title: origTitle,
    year,
    country: countryStr.split(',').map(s => s.trim()),
    genre: genreStr.split(',').map(s => s.trim()),
    rating,
    is_premiere: isPremiere,
    language,
    quality,
    duration,
    description,
    parts,
    total_size: totalSize,
    created_at: new Date().toISOString(),
  };

  // Poster + metadata yuklash
  console.log('\n🖼️ Poster va metadata yuklanmoqda...');
  const metaMsgId = await uploadPosterAndMeta(client, channelEntity, posterPath, metadata);

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ "${title}" muvaffaqiyatli yuklandi!`);
  console.log(`📢 Kanal Message ID: ${metaMsgId}`);
  console.log(`📦 Jami qismlar: ${parts.length} ta`);
  console.log(`💾 Jami hajm: ${formatSize(totalSize)}`);
  console.log('═══════════════════════════════════════\n');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Xato:', err.message);
  process.exit(1);
});
