import { fetchTodayTasks, fetchTodayWorkType, resetDailyTasks, fetchWeeklyNoteCount } from '../notion/client';
import { generateMorningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runMorningNotification(): Promise<void> {
  console.log('🌅 毎朝通知を開始します...');

  try {
    // 毎日タスクをリセット
    await resetDailyTasks();

    // Notionからデータ取得
    const [tasks, workType, weeklyNoteCount] = await Promise.all([
      fetchTodayTasks(),
      fetchTodayWorkType(),
      fetchWeeklyNoteCount(),
    ]);

    console.log(`勤務種類: ${workType ?? '未設定'}`);
    console.log(`今日のタスク: ${tasks.length}件`);
    console.log(`今週のnote: ${weeklyNoteCount}本`);

    // Geminiでコメント生成
    const message = await generateMorningComment(workType, tasks, weeklyNoteCount);

    // LINE送信
    await sendLineMessage(message);

    console.log('✅ 毎朝通知が完了しました');
  } catch (err) {
    console.error('❌ 毎朝通知でエラーが発生しました:', err);
    throw err;
  }
}
