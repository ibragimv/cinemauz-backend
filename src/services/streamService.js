const { getClient } = require('../telegram/client');
const { Api } = require('telegram');
const bigInt = require('big-integer');
const config = require('../config');

const CHANNEL_ID = config.CHANNEL_ID;
const REQUEST_SIZE = 1024 * 1024; // 1MB per Telegram request

// Parts umumiy hajmi
function getTotalSize(parts) {
  return parts.reduce((sum, p) => sum + (p.size || 0), 0);
}

// Bitta Telegram xabaridan Range stream qilish
async function streamPart(client, channelMsgId, localStart, localEnd, res) {
  // Xabarni kanaldan olish (file reference yangilanadi)
  const messages = await client.getMessages(CHANNEL_ID, {
    ids: [parseInt(channelMsgId)],
  });

  const msg = messages[0];
  if (!msg) throw new Error(`Xabar topilmadi: ${channelMsgId}`);

  const doc = msg.document || msg.media?.document;
  if (!doc) throw new Error('Video fayl topilmadi');

  const inputLocation = new Api.InputDocumentFileLocation({
    id: doc.id,
    accessHash: doc.accessHash,
    fileReference: doc.fileReference,
    thumbSize: '',
  });

  // Offset 4096 ga moslash (Telegram protokoli talabi)
  const alignedStart = Math.floor(localStart / 4096) * 4096;
  const skipBytes = localStart - alignedStart;
  const targetBytes = localEnd - localStart + 1;

  let bytesSent = 0;
  let isFirst = true;

  for await (const chunk of client.iterDownload({
    file: inputLocation,
    offset: bigInt(alignedStart),
    requestSize: REQUEST_SIZE,
    dcId: doc.dcId,
  })) {
    if (bytesSent >= targetBytes) break;

    let data = Buffer.from(chunk);

    // Birinchi chunkda alignment skipni o'tkazib yuborish
    if (isFirst && skipBytes > 0) {
      data = data.slice(skipBytes);
      isFirst = false;
    }

    // Oxirgi chunkni kerakli miqdorda kesish
    const remaining = targetBytes - bytesSent;
    if (data.length > remaining) {
      data = data.slice(0, remaining);
    }

    // Backpressure boshqaruv
    const canWrite = res.write(data);
    bytesSent += data.length;

    if (!canWrite) {
      await new Promise(resolve => res.once('drain', resolve));
    }

    if (bytesSent >= targetBytes) break;
  }
}

// Ko'p qismli videoni seamless stream qilish
async function streamMovie(movie, rangeStart, rangeEnd, res, customParts = null) {
  const client = await getClient();
  const parts = customParts || movie.parts || [];
  const totalSize = getTotalSize(parts);

  if (totalSize === 0) throw new Error('Fayl hajmi noma\'lum');
  if (parts.length === 0) throw new Error('Video qismlari topilmadi');

  const start = rangeStart || 0;
  const end = Math.min(rangeEnd !== undefined ? rangeEnd : totalSize - 1, totalSize - 1);

  if (start > end) {
    res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
    return;
  }

  const contentLength = end - start + 1;

  // Headers
  res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
  res.setHeader('Content-Length', contentLength);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');
  res.writeHead(206);

  // Qaysi part(lar)dan o'qish kerakligini hisoblash
  let cumulativeSize = 0;

  for (const part of parts) {
    const partStart = cumulativeSize;
    const partEnd = cumulativeSize + part.size - 1;
    cumulativeSize += part.size;

    // Bu part bizning range ga tegishli emasmi?
    if (partEnd < start) continue;   // Bu part dan oldin
    if (partStart > end) break;      // Bu part dan keyin

    // Bu partdagi local offset
    const localStart = Math.max(0, start - partStart);
    const localEnd = Math.min(part.size - 1, end - partStart);

    await streamPart(client, part.channel_msg_id, localStart, localEnd, res);
  }

  res.end();
}

module.exports = { streamMovie, getTotalSize };
