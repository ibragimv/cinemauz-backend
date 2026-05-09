const authService = require('./src/services/auth.service');

async function fix() {
    console.log("🛠 Manually fixing subscription for user...");
    // 8435465488 - telegramId, 1778100146411 - userId
    await authService.updateSubscription(8435465488, '3_month', '1778100146411');
    console.log("✅ Done.");
    process.exit(0);
}

fix();
