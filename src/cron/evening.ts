import { fetchTodayCompletedTasks, fetchTodayInProgressTasks, fetchTomorrowInfo } from '../notion/client';
import { fetchWorkTypeFromCalendar, fetchTomorrowCalendarEvents } from '../google/calendar';
import { generateEveningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';
import { getTodayProgressRecords } from '../notion/record';

export async function runEveningNotification(): Promise<void> {
  console.log('🌙 夜の振り返り通知を開始します...');
  try {
    const [completedTasks, inProgressTasks, tomorrowTasks, progressRecords] = await Promise.all([
      fetchTodayCompletedTasks(),
      fetchTodayInProgressTasks(),
      fetchTomorrowInfo(),
      getTodayProgressRecords(),
    ]);
    let workType: string | null = null;
    let tomorrowCalendarEvents: any[] = [];
    try {
      const [calWorkType, tomorrowEvents] = await Promise.all([
        fetchWorkTypeFromCalendar(),
        fetchTomorrowCalendarEvents(),
      ]);
      workType = calWorkType;
      tomorrowCalendarEvents = tomorrowEvents;
    } catch (err) {
      console.warn('Googleカレンダー取得失敗:', err);
    }
    console.log(`今日の完了タスク: ${completedTasks.length}件`);
    console.log(`進行中タスク: ${inProgressTasks.length}件`);
    console.log(`今日の進捗記録: ${progressRecords.length}件`);
    console.log(`勤務種類: ${workType ?? '未設定'}`);
    const message = await generateEveningComment(
      workType,
      completedTasks,
      inProgressTasks,
      tomorrowTasks,
      tomorrowCalendarEvents,
      progressRecords,
    );
    await sendLineMessage(message);
    console.log('✅ 夜の振り返り通知が完了しました');
  } catch (err) {
    console.error('❌ 夜の振り返り通知でエラーが発生しました:', err);
    throw err;
  }
}
