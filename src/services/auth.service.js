const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bot = require('../telegram/bot');
const { getClient } = require('../telegram/client');

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret';
const USERS_CHANNEL_ID = process.env.USERS_CHANNEL_ID;

let usersCache = [];
const usersFile = path.join(__dirname, '../../users.json');

const saveLocal = () => {
  const slim = usersCache.map(u => ({
    id: u.id,
    email: u.email || null,
    telegramId: u.telegramId || null,
    telegram_message_id: u.telegram_message_id || null
  }));
  fs.writeFileSync(usersFile, JSON.stringify(slim, null, 2));
};

if (fs.existsSync(usersFile)) {
  try { usersCache = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch (e) { usersCache = []; }
}

// Telegramdan bitta foydalanuvchini to'liq o'qib olish
// Ma'lumotlarni xotirada keshlab turish (Telegram so'rovlarini kamaytirish uchun)
const fullUserCache = new Map();

const fetchFullUser = async (user) => {
  if (!user.telegram_message_id || !USERS_CHANNEL_ID) return user;

  // Agar keshda bo'lsa va 5 daqiqadan o'tmagan bo'lsa, keshdan beramiz
  const cached = fullUserCache.get(user.id);
  if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
    console.log(`⚡ [Auth] Keshdan olindi: ${user.id}`);
    console.log(`🔍 [Auth] Keshdagi ma'lumotlar: ${JSON.stringify(cached.data).substring(0, 100)}...`);
    Object.assign(user, cached.data);
    return user;
  }
  
  try {
    console.log(`🔄 [Auth] Telegramdan yuklanmoqda... (Msg ID: ${user.telegram_message_id})`);
    const client = await getClient();
    if (!client) {
      console.error("❌ [Auth] Telegram client topilmadi");
      return user;
    }

    const channelId = USERS_CHANNEL_ID.toString().startsWith('-100') 
      ? USERS_CHANNEL_ID 
      : `-100${USERS_CHANNEL_ID}`;

    // Telegramdan o'qish (Timeout bilan - 10 soniya)
    const msgsPromise = client.getMessages(channelId, { ids: [parseInt(user.telegram_message_id)] });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
    
    const msgs = await Promise.race([msgsPromise, timeoutPromise]);
    const msg = msgs[0];
    
    if (!msg) {
      console.warn(`⚠️ [Auth] Telegramdan xabar topilmadi (ID: ${user.telegram_message_id})`);
      return user;
    }

    console.log(`📩 [Auth] Xabar matni olindi (uzunligi: ${msg.text?.length || 0})`);

    if (msg && msg.text) {
      let jsonContent = null;
      const preMatch = msg.text.match(/<pre>([\s\S]*?)<\/pre>/);
      if (preMatch && preMatch[1]) {
        jsonContent = preMatch[1];
        console.log("🔍 [Auth] <pre> tegi ichidan JSON topildi");
      } else {
        const jsonMatch = msg.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
          console.log("🔍 [Auth] Regex orqali JSON topildi");
        }
      }

      if (jsonContent) {
        try {
          const fullData = JSON.parse(jsonContent);
          console.log("✅ [Auth] JSON muvaffaqiyatli parslash qilindi");
          
          // Default subscription
          if (!fullData.subscription) {
            fullData.subscription = { plan: 'free', isActive: false, expiryDate: null };
          }

          // Keshga saqlash
          fullUserCache.set(user.id, { data: fullData, timestamp: Date.now() });
          
          Object.assign(user, fullData);
          console.log(`✅ [Auth] Telegramdan yuklandi va keshlandi: ${user.id}`);
          return user;
        } catch (e) { 
          console.error("❌ [Auth] JSON Error:", e.message); 
          console.error("DEBUG CONTENT:", jsonContent);
        }
      } else {
        console.warn("⚠️ [Auth] Xabarda JSON mazmuni topilmadi");
      }
    }
  } catch (err) { 
    console.error("❌ [Auth] Telegram Fetch Error:", err.message); 
  }
  return user;
};

const syncToTelegram = async (user) => {
  if (!USERS_CHANNEL_ID || USERS_CHANNEL_ID === "-1000000000000") return;
  // Saqlashdan oldin slim ma'lumotlarni emas, to'liq user obyektini yuboramiz
  const content = JSON.stringify(user, null, 2);
  const message = `👤 <b>USER PROFILE DATABASE</b>\n\n<pre>${content}</pre>\n\n#id${user.id}`;
  try {
    if (user.telegram_message_id) {
      await bot.editMessageText(message, { chat_id: USERS_CHANNEL_ID, message_id: user.telegram_message_id, parse_mode: 'HTML' });
    } else {
      const sent = await bot.sendMessage(USERS_CHANNEL_ID, message, { parse_mode: 'HTML' });
      user.telegram_message_id = sent.message_id;
      saveLocal();
    }
  } catch (err) { console.error("Sync Error:", err.message); }
};

const recoverFromTelegram = async () => {
  if (!USERS_CHANNEL_ID) return;
  try {
    const client = await getClient();
    if (!client) return;
    const messages = await client.getMessages(USERS_CHANNEL_ID, { limit: 100 });
    const recovered = [];
    for (const msg of messages) {
      if (msg.text && msg.text.includes('USER PROFILE DATABASE')) {
        const jsonMatch = msg.text.match(/<pre>([\s\S]*?)<\/pre>/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            const userData = JSON.parse(jsonMatch[1]);
            userData.telegram_message_id = msg.id;
            recovered.push(userData);
          } catch (e) { }
        }
      }
    }
    if (recovered.length > 0) { usersCache = recovered; saveLocal(); }
  } catch (err) { console.error("Recovery Error:", err.message); }
};

setTimeout(recoverFromTelegram, 10000);

const detectDevice = (ua = '') => {
  ua = (ua || '').toLowerCase();
  let t = 'Desktop', o = 'Unknown', i = 'monitor';
  if (/android/.test(ua)) { t = 'Mobile'; o = 'Android'; i = 'smartphone'; }
  else if (/iphone|ipad|ipod/.test(ua)) { t = 'Mobile'; o = 'iOS'; i = 'smartphone'; }
  else if (/windows/.test(ua)) { o = 'Windows'; }
  return { type: t, os: o, icon: i };
};

const updateSessions = (user, reqInfo) => {
  const device = detectDevice(reqInfo.userAgent);
  const ip = reqInfo.ip || '::1';
  user.sessions = user.sessions || [];
  const existingIdx = user.sessions.findIndex(s => s.os === device.os && s.type === device.type && s.ip === ip);
  if (existingIdx !== -1) {
    user.sessions[existingIdx].lastActive = new Date().toISOString();
    const session = user.sessions.splice(existingIdx, 1)[0];
    user.sessions.unshift(session);
  } else {
    user.sessions.unshift({ id: Date.now().toString(), ...device, ip, lastActive: new Date().toISOString() });
  }
  user.sessions = user.sessions.slice(0, 5);
};

const otpStore = new Map();

const authService = {
  async checkUserStatus(email) {
    const user = usersCache.find(u => u.email === email);
    return { exists: !!user, hasPin: !!(user && user.pin) };
  },

  async sendOTP(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    try {
      const { data, error } = await resend.emails.send({
        from: 'CinemaUz <onboarding@resend.dev>',
        to: email,
        subject: 'Tasdiqlash kodi',
        html: `<div style="background:#08080a; color:#fff; padding:30px; text-align:center; border-radius:15px;"><h1>${otp}</h1></div>`
      });
      if (error) throw new Error(error.message);
      return { success: true };
    } catch (e) {
      console.log(`🔐 BACKUP KOD: ${otp}`);
      throw new Error(e.message || "Email xatosi");
    }
  },

  async verifyPIN(email, pin, reqInfo = {}) {
    let user = usersCache.find(u => u.email === email);
    if (!user || !user.pin) throw new Error("Profil topilmadi");

    // Telegramdan eng so'nggi ma'lumotlarni olish
    user = await fetchFullUser(user);

    if (user.pin !== pin) throw new Error("PIN-kod noto'g'ri");
    updateSessions(user, reqInfo);
    saveLocal();
    syncToTelegram(user);
    return { token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' }), user };
  },

  async verifyOTP(email, code, reqInfo = {}) {
    const record = otpStore.get(email);
    if (!record || record.otp !== code) throw new Error("Kod noto'g'ri");
    otpStore.delete(email);

    let user = usersCache.find(u => u.email === email);

    if (user) {
      // Telegramdan tekshirish
      user = await fetchFullUser(user);
      if (user.firstName) {
        updateSessions(user, reqInfo);
        saveLocal();
        syncToTelegram(user);
        return { isNewUser: false, token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' }), user };
      }
    }

    return { isNewUser: true, tempToken: jwt.sign({ email, temp: true }, JWT_SECRET, { expiresIn: '15m' }) };
  },

  async completeProfile(data, reqInfo = {}) {
    let email = null;
    if (data.tempToken) {
      try { email = jwt.verify(data.tempToken, JWT_SECRET).email; } catch (e) { throw new Error("Token eskirgan"); }
    }

    let user = usersCache.find(u => u.email === email);

    if (user) {
      user = await fetchFullUser(user);
      user.firstName = data.firstName;
      user.lastName = data.lastName || '';
      user.pin = data.pin || null;
      user.age = parseInt(data.age) || null;
      user.gender = data.gender || 'erkak';
      user.photoUrl = data.photoUrl || '';
    } else {
      user = {
        id: Date.now().toString(),
        email,
        telegramId: data.telegramId || null,
        firstName: data.firstName,
        lastName: data.lastName || '',
        pin: data.pin || null,
        age: parseInt(data.age) || null,
        gender: data.gender || 'erkak',
        photoUrl: data.photoUrl || '',
        role: 'user',
        createdAt: new Date().toISOString(),
        savedMovies: [],
        likedMovies: [],
        notificationSettings: { newMovies: true, system: true },
        sessions: [],
        payments: []
      };
      usersCache.push(user);
    }

    updateSessions(user, reqInfo);
    saveLocal();
    await syncToTelegram(user);
    return { token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' }), user };
  },

  async verifyTelegramAuth(authData, reqInfo = {}) {
    const crypto = require('crypto');
    const { hash, ...dataCheck } = authData;
    const secretKey = crypto.createHash('sha256').update(process.env.BOT_TOKEN).digest();
    const dataCheckString = Object.keys(dataCheck).sort().map(k => `${k}=${dataCheck[k]}`).join('\n');
    if (crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex') !== hash) throw new Error("Soxta!");
    let user = usersCache.find(u => u.telegramId == authData.id);
    if (user) {
      user = await fetchFullUser(user);
      updateSessions(user, reqInfo);
      saveLocal();
      syncToTelegram(user);
      return { isNewUser: false, token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' }), user };
    }
    return { isNewUser: true, telegramData: { telegramId: authData.id, firstName: authData.first_name, lastName: authData.last_name || '', photoUrl: authData.photo_url || '' } };
  },

  async updateProfile(userId, data) {
    let user = usersCache.find(u => u.id === userId);
    if (!user) throw new Error("Topilmadi");

    user = await fetchFullUser(user);

    const allowed = ['firstName', 'lastName', 'age', 'gender', 'photoUrl', 'notificationSettings', 'pin', 'subscription', 'payments', 'balance'];
    Object.keys(data).forEach(k => { if (allowed.includes(k)) user[k] = data[k]; });
    
    // Keshni tozalash
    fullUserCache.delete(userId);

    saveLocal();
    syncToTelegram(user);
    return user;
  },

  async addBalance(telegramId, amount, userId) {
    let user = usersCache.find(u => u.telegramId == telegramId || u.id === userId);
    if (!user) throw new Error("User topilmadi");

    user = await fetchFullUser(user);
    user.balance = (user.balance || 0) + parseFloat(amount);
      
    // To'lov tarixiga yozish
    user.payments = user.payments || [];
    user.payments.push({
      id: Date.now().toString(),
      amount: amount,
      type: 'deposit',
      date: new Date().toISOString(),
      status: 'completed'
    });

    fullUserCache.delete(user.id);
    saveLocal();
    syncToTelegram(user);
    return user;
  },

  async buyPlan(userId, planId) {
    let user = usersCache.find(u => u.id === userId);
    if (!user) throw new Error("User topilmadi");

    user = await fetchFullUser(user);
    
    const PLANS = {
      '1_month': { price: 15000 },
      '3_month': { price: 40000 },
      '1_year': { price: 120000 }
    };

    const plan = PLANS[planId];
    if (!plan) throw new Error("Noto'g'ri tarif");

    if ((user.balance || 0) < plan.price) {
      throw new Error("Mablag' yetarli emas. Iltimos, balansingizni to'ldiring.");
    }

    user.balance -= plan.price;
    
    // Obunani faollashtirish
    await this.updateSubscription(user.telegramId, planId, user.id);

    // To'lov tarixiga yozish
    user.payments = user.payments || [];
    user.payments.push({
      id: Date.now().toString(),
      amount: plan.price,
      type: 'plan_purchase',
      planId: planId,
      date: new Date().toISOString(),
      status: 'completed'
    });

    fullUserCache.delete(user.id);
    saveLocal();
    syncToTelegram(user);
    return user;
  },

  async toggleMovieStatus(userId, movieId, type) {
    let user = usersCache.find(u => u.id === userId);
    if (!user) throw new Error("Topilmadi");

    user = await fetchFullUser(user);

    const field = type === 'save' ? 'savedMovies' : 'likedMovies';
    user[field] = user[field] || [];
    const idx = user[field].indexOf(movieId);
    if (idx === -1) user[field].push(movieId); else user[field].splice(idx, 1);
    saveLocal();
    syncToTelegram(user);
    return { [field]: user[field] };
  },

  async updateSubscription(telegramId, planId, userId = null) {
    let user = usersCache.find(u => u.telegramId == telegramId);
    
    if (!user && userId) {
      console.log(`🔍 [Subscription] Telegram ID orqali topilmadi, User ID orqali qidirilmoqda: ${userId}`);
      user = usersCache.find(u => u.id === userId);
    }

    if (!user) {
      console.error(`❌ [Subscription] User not found for Telegram ID: ${telegramId} or User ID: ${userId}`);
      return;
    }

    // Agar foydalanuvchida hali telegramId bo'lmasa (masalan email login), uni saqlab qo'yamiz
    if (!user.telegramId) {
      user.telegramId = telegramId;
      console.log(`🔗 [Subscription] User ${user.id} uchun Telegram ID bog'landi: ${telegramId}`);
    }

    // Eng so'nggi ma'lumotlarni Telegramdan olamiz
    user = await fetchFullUser(user);

    const now = new Date();
    let expiryDate = new Date();

    if (planId === '1_month') expiryDate.setMonth(now.getMonth() + 1);
    else if (planId === '3_month') expiryDate.setMonth(now.getMonth() + 3);
    else if (planId === '1_year') expiryDate.setFullYear(now.getFullYear() + 1);

    user.subscription = {
      plan: planId,
      isActive: true,
      expiryDate: expiryDate.toISOString(),
      updatedAt: new Date().toISOString()
    };

    // To'lov tarixini qo'shish
    user.payments = user.payments || [];
    user.payments.unshift({
      id: Date.now().toString(),
      plan: planId,
      amount: planId === '1_month' ? 15000 : planId === '3_month' ? 40000 : 120000,
      currency: 'UZS',
      date: new Date().toISOString(),
      status: 'success'
    });
    user.payments = user.payments.slice(0, 10);

    console.log(`✅ [Subscription] User ${user.id} upgraded to ${planId}. Expiry: ${user.subscription.expiryDate}`);

    // Keshni tozalash
    fullUserCache.delete(user.id);
    
    saveLocal();
    await syncToTelegram(user);
    return user;
  },

  async resetSubscription(userId) {
    let user = usersCache.find(u => u.id === userId);
    if (!user) return;
    
    fullUserCache.delete(userId);
    user = await fetchFullUser(user);
    
    user.subscription = { plan: 'free', isActive: false, expiryDate: null };
    user.payments = [];
    
    fullUserCache.delete(userId);
    saveLocal();
    await syncToTelegram(user);
    console.log(`🧹 [Auth] Subscription reset for ${userId}`);
    return user;
  },

  getUsersList() { return usersCache; },
  fetchFullUser,
  clearCache: (userId) => fullUserCache.delete(userId),
  syncToTelegram // Eksport qilish
};

module.exports = authService;
