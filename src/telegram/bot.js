const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// To'lovdan oldin tekshirish (Pre-checkout)
bot.on('pre_checkout_query', (query) => {
  // Biz barcha to'lovlarni qabul qilamiz
  bot.answerPreCheckoutQuery(query.id, true)
    .then(() => console.log(`✅ [Payment] Pre-checkout approved for: ${query.from.id}`))
    .catch((err) => console.error(`❌ [Payment] Pre-checkout error:`, err.message));
});

// To'lov muvaffaqiyatli yakunlanganda
bot.on('message', async (msg) => {
  if (msg.successful_payment) {
    const authService = require('../services/auth.service');
    const payment = msg.successful_payment;
    const telegramId = msg.from.id;

    try {
      const payload = JSON.parse(payment.invoice_payload);
      const { userId, type, amount, plan: planId } = payload;

      console.log(`💰 [Payment] SUCCESS: User ${userId} (TG: ${telegramId}) paid ${payment.total_amount / 100} UZS. Type=${type}`);
      
      if (type === 'deposit') {
        // Balansni to'ldirish
        await authService.addBalance(telegramId, amount, userId);
        bot.sendMessage(telegramId, `✅ Tabriklaymiz! Balansingiz muvaffaqiyatli ${amount.toLocaleString()} so'mga to'ldirildi. Endi siz xohlagan tarifingizni sotib olishingiz mumkin!`, {
          reply_markup: {
            inline_keyboard: [[{ text: "Saytga o'tish", url: "https://t.me/cinema_uz_bot/app" }]]
          }
        });
      } else {
        // Eski usul: To'g'ridan-to'g'ri tarif (Backward compatibility)
        await authService.updateSubscription(telegramId, planId, userId);
        bot.sendMessage(telegramId, `🎉 Tabriklaymiz! Sizning Premium tarifingiz muvaffaqiyatli faollashtirildi.\n\nEndi siz CinemaUZ platformasidan cheklovlarsiz foydalanishingiz mumkin!`, {
          reply_markup: {
            inline_keyboard: [[{ text: "Saytga o'tish", url: "https://t.me/cinema_uz_bot/app" }]]
          }
        });
      }
    } catch (err) {
      console.error(`❌ [Payment] Error processing successful payment:`, err.message);
    }
  }
});

module.exports = bot;
