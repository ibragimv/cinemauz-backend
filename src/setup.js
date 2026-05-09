/**
 * Bu faylni FAQAT BIR MARTA ishga tushiring!
 * GramJS session string olish uchun.
 *
 * Ishlatish: node src/setup.js
 */

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

(async () => {
  console.log('🔐 GramJS session yaratish...\n');

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      console.log("Telefon raqamingizni kiriting (masalan: +998901234567):");
      return await input.text('Telefon: ');
    },
    password: async () => {
      console.log("2FA parolingizni kiriting (agar yo'q bo'lsa Enter bosing):");
      return await input.text('Parol: ');
    },
    phoneCode: async () => {
      console.log("Telegramdan kelgan kodni kiriting:");
      return await input.text('Kod: ');
    },
    onError: (err) => console.error('Xato:', err),
  });

  const sessionString = client.session.save();

  console.log('\n✅ Session muvaffaqiyatli yaratildi!\n');
  console.log('📋 .env faylingizga quyidagini qo\'shing:\n');
  console.log(`TELEGRAM_SESSION=${sessionString}`);
  console.log('\n⚠️  Bu string ni hech kimga bermang!\n');

  await client.disconnect();
  process.exit(0);
})();
