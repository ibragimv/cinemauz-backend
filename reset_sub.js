const authService = require('./src/services/auth.service');

async function reset() {
    const userId = "1778100146411";
    console.log(`🧹 FINAL ATTEMPT: Resetting premium for user ${userId}...`);
    
    await authService.resetSubscription(userId);
    
    console.log("✅ DONE.");
    process.exit(0);
}

reset();
