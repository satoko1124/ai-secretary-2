import { fetchWeeklyStats } from '../notion/client';
import { generateWeeklyComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runWeeklyReport(): Promise<void> {
  console.log('📊 週報通知を開始します...');

  try {
    // Notionから今週のデータを集計
    const stats = await fetchWeeklyStats();

    console.log(`完了タスク: ${stats.completedCount}件`);
    console.log(`当直: ${stats.nightShiftCount}回`);

    // OpenAIで週報コメント生成
    const message = await generateWeeklyComment(stats);

    // LINE送信
    await sendLineMessage(message);

    console.log('✅ 週報通知が完了しました');
  } catch (err) {
    console.error('❌ 週報通知でエラーが発生しました:', err);
    throw err;
  }
}
