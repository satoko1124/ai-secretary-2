import { fetchTodayCompletedTasks, fetchTodayInProgressTasks, fetchTodayWorkType, fetchTomorrowInfo } from '../notion/client';
import { fetchTomorrowCalendarEvents } from '../google/calendar';
import { generateEveningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runEveningNotification(): Promise<void> {
  console.log('🌙 夜の振り返り通知を開始します...');

  try {
    const [completedTasks, inProgressTasks, workType, tomorrowTasks] = await Promise.all([
      fetchTodayCompletedTasks(),
      fetchTodayInProgressTasks(),
      fetchTodayWorkType(),
      fetchTomorrowInfo(),
    ]);

    let tomorrowCalendarEvents: any[] = [];
    try {
      tomorrowCalendarEvents = await fetchTomorrowCalendarEvents();
    } catch (err) {
      console.warn('明日のGoogleカレンダー取得失敗:', err);
    }

    console.log(`今日の完了タスク: ${completedTasks.length}件`);
    console.log(`進行中タスク: ${inProgressTasks.length}件`);

    const message = await generateEveningComment(
      workType,
      completedTasks,
      inProgressTasks,
      tomorrowTasks,
      tomorrowCalendarEvents
    );
    await sendLineMessage(message);

    console.log('✅ 夜の振り返り通知が完了しました');
  } catch (err) {
    console.error('❌ 夜の振り返り通知でエラーが発生しました:', err);
    throw err;
  }
}
