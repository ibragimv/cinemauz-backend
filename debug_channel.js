const { getClient } = require('./src/telegram/client');
const config = require('./src/config');

async function debugChannel() {
  const client = await getClient();
  const messages = await client.getMessages(config.CHANNEL_ID, { limit: 20 });
  
  for (const msg of messages) {
    console.log(`ID: ${msg.id} | ReplyTo: ${msg.replyTo?.replyToMsgId} | Media: ${!!msg.media}`);
    if (msg.message && msg.message.includes('#CINEMA_META')) {
      console.log(`TEXT: ${msg.message.substring(0, 100)}...`);
    }
    console.log('---');
  }
}

debugChannel().catch(console.error);
