import { fetchTodayTasks, fetchTodayWorkType } from '../notion/client';
import { generateMorningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runMorningNotification(): Promise<void> {
  console.log('🌅 毎朝通知を開始します...');

  try {
    // Notionからデータ取得
    const [tasks, workType] = await Promise.all([
      fetchTodayTasks(),
      fetchTodayWorkType(),
    ]);

    console.log(`勤務種類: ${workType ?? '未設定'}`);
    console.log(`今日のタスク: ${tasks.length}件`);

    // OpenAIでコメント生成
    const message = await generateMorningComment(workType, tasks);

    // LINE送信
    await sendLineMessage(message);

    console.log('✅ 毎朝通知が完了しました');
  } catch (err) {
    console.error('❌ 毎朝通知でエラーが発生しました:', err);
    throw err;
  }
}
