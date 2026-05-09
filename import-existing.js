/**
 * Kanaldan mavjud videolarni import qilish
 * Kanalda allaqachon yuklangan katta fayllar uchun
 * 
 * Ishlatish: node import-existing.js
 */

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const client = new TelegramClient(
  new StringSession(process.env.TELEGRAM_SESSION),
  parseInt(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 5 }
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const META_TAG = '#CINEMA_META';
const CHANNEL_ID = process.env.CHANNEL_ID;

function formatSize(bytes) {
  if (!bytes) return 'N/A';
  if (bytes > 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  return bytes + ' B';
}

async function getVideoMessages() {
  console.log('\n📋 Kanaldan video xabarlar o\'qilmoqda...\n');
  const messages = [];
  let offsetId = 0;

  while (true) {
    const batch = await client.getMessages(CHANNEL_ID, {
      limit: 100,
      offsetId,
    });
    if (!batch || batch.length === 0) break;

    for (const msg of batch) {
      if (msg.document || msg.video) {
        const doc = msg.document || msg.video;
        const size = Number(doc.size || 0);
        messages.push({
          msg_id: msg.id,
          size,
          date: new Date(msg.date * 1000).toLocaleString(),
          mime: doc.mimeType || 'video/mp4',
        });
        console.log(`  📹 Msg ID: ${msg.id} | Hajm: ${formatSize(size)} | Sana: ${new Date(msg.date * 1000).toLocaleString()}`);
      }
    }
    offsetId = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  return messages;
}

async function main() {
  await client.connect();
  console.log('✅ Telegram\'ga ulandi\n');

  const videos = await getVideoMessages();

  if (videos.length === 0) {
    console.log('❌ Kanalda video topilmadi');
    process.exit(0);
  }

  console.log(`\nJami ${videos.length} ta video topildi\n`);

  // Har bir video uchun metadata so'rash
  for (const video of videos) {
    console.log('\n' + '═'.repeat(50));
    console.log(`📹 Msg ID: ${video.msg_id} | ${formatSize(video.size)}`);
    console.log('Ushbu video uchun metadata kiritasizmi? (ha/o\'tkazib yuborish)');
    
    const confirm = await ask('> ');
    if (confirm.toLowerCase() !== 'ha') continue;

    const title       = await ask('📝 Kino nomi: ');
    const origTitle   = await ask('📝 Original nomi (Enter = xuddi shu): ') || title;
    const year        = parseInt(await ask('📅 Yil: '));
    const country     = (await ask('🌍 Davlat (USA, Korea): ')).split(',').map(s => s.trim());
    const genre       = (await ask('🎭 Janr (Action, Drama): ')).split(',').map(s => s.trim());
    const rating      = parseFloat(await ask('⭐ Reyting (1-10): '));
    const isPremiere  = (await ask('🔥 Premyera? (ha/yoq): ')).toLowerCase() === 'ha';
    const language    = await ask("🗣️ Til (O'zbek tilida): ");
    const quality     = await ask('📺 Sifat (1080p): ');
    const duration    = parseInt(await ask('⏱️ Davomiylik (daqiqada): '));
    const description = await ask('📝 Tavsif: ');
    const posterMsgId = parseInt(await ask('🖼️ Poster xabar ID (0 = yo\'q): ') || '0');

    const metadata = {
      title,
      original_title: origTitle,
      year,
      country,
      genre,
      rating,
      is_premiere: isPremiere,
      language,
      quality,
      duration,
      description,
      parts: [{ index: 0, channel_msg_id: video.msg_id, size: video.size }],
      total_size: video.size,
      created_at: new Date().toISOString(),
    };

    const caption = `${META_TAG}\n${JSON.stringify(metadata)}`;
    const channelEntity = await client.getEntity(CHANNEL_ID);

    // Poster bor bo'lsa, shu posterni ishlatamiz
    if (posterMsgId > 0) {
      try {
        const posterMsg = await client.getMessages(CHANNEL_ID, { ids: [posterMsgId] });
        if (posterMsg[0]?.photo) {
          await client.sendFile(channelEntity, {
            file: posterMsg[0].photo,
            caption,
          });
          console.log(`✅ "${title}" metadata yuborildi!`);
          continue;
        }
      } catch {}
    }

    // Poster yo'q — faqat matn
    await client.sendMessage(channelEntity, { message: caption });
    console.log(`✅ "${title}" metadata (postersiz) yuborildi!`);
  }

  console.log('\n✅ Import yakunlandi!');
  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Xato:', err.message);
  process.exit(1);
});
