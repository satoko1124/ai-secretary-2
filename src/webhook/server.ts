import * as http from 'http';
import { verifyLineSignature, handleLineMessage } from './handler';

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // ヘルスチェック
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AI秘書 Webhook サーバー稼働中');
    return;
  }

  // LINEからのWebhook
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // 署名検証
        const signature = req.headers['x-line-signature'] as string;
        if (!signature || !verifyLineSignature(body, signature)) {
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }

        const parsed = JSON.parse(body);
        const events = parsed.events ?? [];

        for (const event of events) {
          if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const text = event.message.text;
            await handleLineMessage(userId, text);
          }
        }

        res.writeHead(200);
        res.end('OK');
      } catch (err) {
        console.error('Webhookエラー:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Webhookサーバーが起動しました: port ${PORT}`);
});
