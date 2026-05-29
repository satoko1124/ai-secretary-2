import { fetchMonthlyStats } from '../notion/client';
import { generateMonthlyComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runMonthlyReport(): Promise<void> {
  console.log('📅 月報通知を開始します...');

  try {
    const stats = await fetchMonthlyStats();
    console.log(`先月の完了タスク: ${stats.completedCount}件`);

    const message = await generateMonthlyComment(stats);
    await sendLineMessage(message);

    console.log('✅ 月報通知が完了しました');
  } catch (err) {
    console.error('❌ 月報通知でエラーが発生しました:', err);
    throw err;
  }
}
