const bot = require('../../telegram/bot');
const authService = require('../../services/auth.service');
const kb = require('../keyboards');

async function showUsersStats(chatId, msgId) {
  try {
    const users = authService.getUsersList();
    const totalUsers = users.length;
    
    // Sort by createdAt descending
    const sortedUsers = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentUsers = sortedUsers.slice(0, 10);
    
    let text = `👥 *Foydalanuvchilar Statistikasi*\n\n`;
    text += `Jami ro'yxatdan o'tganlar: *${totalUsers}* ta\n\n`;
    
    if (totalUsers > 0) {
      text += `*Oxirgi 10 ta foydalanuvchi:*\n`;
      recentUsers.forEach((u, idx) => {
        const date = new Date(u.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        text += `${idx + 1}. ${u.firstName} ${u.lastName || ''} - ${date}\n`;
      });
    } else {
      text += `Hozircha foydalanuvchilar yo'q.`;
    }

    if (msgId) {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: kb.backToMenuKeyboard(),
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: kb.backToMenuKeyboard(),
      });
    }
  } catch (err) {
    console.error("Foydalanuvchi stats xatosi:", err);
    await bot.sendMessage(chatId, "Xatolik yuz berdi.");
  }
}

module.exports = { showUsersStats };
