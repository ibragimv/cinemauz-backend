const authService = require('./src/services/auth.service');

async function debug() {
    const userId = "1778100146411";
    console.log(`🔍 Debugging user ${userId}...`);
    
    authService.clearCache(userId);
    const users = authService.getUsersList();
    let user = users.find(u => u.id === userId);
    
    if (user) {
        console.log("📍 Local user state:", JSON.stringify(user.subscription));
        user = await authService.fetchFullUser(user);
        console.log("📍 Telegram user state:", JSON.stringify(user.subscription));
    } else {
        console.log("❌ User not found locally.");
    }
    process.exit(0);
}

debug();
