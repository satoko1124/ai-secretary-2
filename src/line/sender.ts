import axios from 'axios';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

export async function sendLineMessage(message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN または LINE_USER_ID が設定されていません');
  }

  await axios.post(
    LINE_API_URL,
    {
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  console.log('✅ LINEメッセージを送信しました');
}
