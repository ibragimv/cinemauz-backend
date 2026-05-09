const { getClient } = require('../telegram/client');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN);
const COMMENTS_CHANNEL = process.env.COMMENTS_CHANNEL_ID || process.env.CHANNEL_ID;

class CommentService {
    async getComments(movieId) {
        try {
            console.log(`🔍 [Comments] Fetching for Movie: ${movieId}`);
            const client = await getClient();
            
            let channelPeer;
            try {
                channelPeer = await client.getEntity(COMMENTS_CHANNEL);
            } catch (e) {
                channelPeer = COMMENTS_CHANNEL;
            }

            // Indexing delayni yengish uchun birinchi navbatda oxirgi 50 ta xabarni olamiz
            let result = await client.getMessages(channelPeer, { limit: 50 });
            
            // Agar undan topilmasa, qidiruvdan ham ko'ramiz
            const searchResult = await client.getMessages(channelPeer, {
                search: `#m_${movieId}`,
                limit: 100
            });
            
            // Ikkala natijani birlashtiramiz va dublikatlarni olib tashlaymiz
            const combined = [...result, ...searchResult];
            const uniqueMsgs = [];
            const seenIds = new Set();
            for (const m of combined) {
                if (!seenIds.has(m.id)) {
                    uniqueMsgs.push(m);
                    seenIds.add(m.id);
                }
            }
            
            result = uniqueMsgs;

            if (!result || result.length === 0) return [];

            const comments = result.map(msg => {
                const text = msg.message || '';
                if (!text.includes(`#m_${movieId}`)) return null;

                const lines = text.split('\n').map(l => l.trim());
                const metaLine = lines[0] || '';
                
                const userIdMatch = metaLine.match(/#u_(\w+)/);
                const replyToMatch = metaLine.match(/#r_(\d+)/);
                
                const avatarMatch = text.match(/\[av: (.*?)\]/);
                
                const likesMatch = text.match(/👍 (\d+)/);
                const dislikesMatch = text.match(/👎 (\d+)/);
                const likedByMatch = text.match(/\[lb: (.*?)\]/);
                const dislikedByMatch = text.match(/\[db: (.*?)\]/);

                // Ism va matnni olishda xatolikka yo'l qo'ymaslik uchun lines[1] ni ehtiyotkorlik bilan tekshiramiz
                const userLine = lines.find(l => l.includes(':')) || lines[1] || '';
                const userNamePart = userLine.split(':')[0] || 'User';
                let commentText = userLine.split(':').slice(1).join(':').trim();
                
                // Agar userLine da matn bo'lmasa, keyingi qatorlardan qidiramiz
                if (!commentText && lines[2] && !lines[2].includes('👍')) {
                    commentText = lines[2];
                }

                return {
                    id: msg.id.toString(),
                    movieId: movieId,
                    userId: userIdMatch ? userIdMatch[1] : 'unknown',
                    userName: userNamePart.trim(),
                    photoUrl: (avatarMatch && avatarMatch[1].trim()) ? avatarMatch[1].trim() : null,
                    text: commentText || text,
                    replyTo: replyToMatch ? replyToMatch[1] : null,
                    likes: likesMatch ? parseInt(likesMatch[1]) : 0,
                    dislikes: dislikesMatch ? parseInt(dislikesMatch[1]) : 0,
                    likedBy: likedByMatch && likedByMatch[1] ? likedByMatch[1].split(',').filter(id => id !== '') : [],
                    dislikedBy: dislikedByMatch && dislikedByMatch[1] ? dislikedByMatch[1].split(',').filter(id => id !== '') : [],
                    createdAt: new Date(msg.date * 1000).toISOString()
                };
            }).filter(c => c !== null && c.text !== '');

            // Vaqt bo'yicha saralash
            comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const commentMap = {};
            comments.forEach(c => commentMap[c.id] = { ...c, replies: [] });
            
            const rootComments = [];
            
            // Birinchi o'tishda barcha ildiz (root) izohlarni aniqlaymiz
            comments.forEach(c => {
                if (!c.replyTo || !commentMap[c.replyTo]) {
                    rootComments.push(commentMap[c.id]);
                }
            });

            // Ikkinchi o'tishda barcha javoblarni (darajasidan qat'iy nazar) o'z ildiziga bog'laymiz
            comments.forEach(c => {
                if (c.replyTo && commentMap[c.replyTo]) {
                    // Haqiqiy ildiz (root) ni topamiz
                    let current = commentMap[c.id];
                    let root = commentMap[c.replyTo];
                    
                    // Rekursiv tarzda eng yuqori ota-onani qidiramiz
                    let safetyCounter = 0;
                    while (root.replyTo && commentMap[root.replyTo] && safetyCounter < 10) {
                        root = commentMap[root.replyTo];
                        safetyCounter++;
                    }
                    
                    // Agar bu o'zi ildiz bo'lmasa, uni ildizning replies ro'yxatiga qo'shamiz
                    if (root.id !== current.id) {
                        // Dublikat bo'lmasligi uchun tekshiramiz
                        if (!root.replies.find(r => r.id === current.id)) {
                            root.replies.push(current);
                        }
                    }
                }
            });

            return rootComments;

            console.log(`✅ [Comments] Loaded ${rootComments.length} root threads`);
            return rootComments;
        } catch (err) {
            console.error('Get Comments Error:', err);
            return [];
        }
    }

    async addComment(commentData) {
        try {
            const { movieId, userId, userName, photoUrl, text, replyTo } = commentData;
            let meta = `#m_${movieId} #u_${userId}`;
            if (replyTo) meta += ` #r_${replyTo}`;
            
            const avatarPart = photoUrl ? `\n[av: ${photoUrl}]` : `\n[av: ]`;
            
            const message = `${meta}\n${userName}: ${text}\n\n👍 0  👎 0\n[lb: ]\n[db: ]${avatarPart}`;
            const sentMsg = await bot.sendMessage(COMMENTS_CHANNEL, message);
            
            console.log(`✉️ [Comments] Sent to Telegram (ID: ${sentMsg.message_id})`);
            
            return {
                id: sentMsg.message_id.toString(),
                movieId, userId, userName, photoUrl, text, replyTo,
                likes: 0, dislikes: 0, likedBy: [], dislikedBy: [],
                replies: [], createdAt: new Date().toISOString()
            };
        } catch (err) {
            console.error('Add Comment Error:', err);
            throw err;
        }
    }

    async deleteComment(commentId, userId) {
        try {
            const client = await getClient();
            const msgs = await client.getMessages(COMMENTS_CHANNEL, { ids: [parseInt(commentId)] });
            if (msgs && msgs[0] && msgs[0].message?.includes(`#u_${userId}`)) {
                await bot.deleteMessage(COMMENTS_CHANNEL, commentId);
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    async toggleReaction(commentId, userId, type) {
        try {
            const client = await getClient();
            const msgs = await client.getMessages(COMMENTS_CHANNEL, { ids: [parseInt(commentId)] });
            if (!msgs || !msgs[0]) return null;
            
            let text = msgs[0].message || '';
            const lbMatch = text.match(/\[lb: (.*?)\]/);
            const dbMatch = text.match(/\[db: (.*?)\]/);
            const avatarMatch = text.match(/\[av: (.*?)\]/);
            
            let likedBy = lbMatch && lbMatch[1] ? lbMatch[1].split(',').filter(id => id) : [];
            let dislikedBy = dbMatch && dbMatch[1] ? dbMatch[1].split(',').filter(id => id) : [];
            
            if (type === 'like') {
                if (likedBy.includes(userId)) likedBy = likedBy.filter(id => id !== userId);
                else {
                    likedBy.push(userId);
                    dislikedBy = dislikedBy.filter(id => id !== userId);
                }
            } else {
                if (dislikedBy.includes(userId)) dislikedBy = dislikedBy.filter(id => id !== userId);
                else {
                    dislikedBy.push(userId);
                    likedBy = likedBy.filter(id => id !== userId);
                }
            }
            
            let newText = text.replace(/👍 \d+/, `👍 ${likedBy.length}`);
            newText = newText.replace(/👎 \d+/, `👎 ${dislikedBy.length}`);
            newText = newText.replace(/\[lb: .*?\]/, `[lb: ${likedBy.join(',')}]`);
            newText = newText.replace(/\[db: .*?\]/, `[db: ${dislikedBy.join(',')}]`);
            
            await bot.editMessageText(newText, { chat_id: COMMENTS_CHANNEL, message_id: commentId });
            return { likes: likedBy.length, dislikes: dislikedBy.length, likedBy, dislikedBy };
        } catch (err) {
            return null;
        }
    }
}

module.exports = new CommentService();
