import { fetchTodayTasks, fetchTodayInProgressTasks, resetDailyTasks, fetchWeeklyNoteCount, fetchWeekRemainingTasks } from '../notion/client';
import { fetchWorkTypeFromCalendar, fetchTodayCalendarEvents } from '../google/calendar';
import { generateMorningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';

export async function runMorningNotification(): Promise<void> {
  console.log('🌅 毎朝通知を開始します...');
  try {
    await resetDailyTasks();

    const [tasks, inProgressTasks, weeklyNoteCount, weekRemainingTasks] = await Promise.all([
      fetchTodayTasks(),
      fetchTodayInProgressTasks(),
      fetchWeeklyNoteCount(),
      fetchWeekRemainingTasks(),
    ]);

    let workType: string | null = null;
    let calendarEvents: any[] = [];
    try {
      const [calWorkType, events] = await Promise.all([
        fetchWorkTypeFromCalendar(),
        fetchTodayCalendarEvents(),
      ]);
      workType = calWorkType;
      calendarEvents = events.filter((e) => !e.isWorkType);
      console.log(`Googleカレンダー予定: ${calendarEvents.length}件`);
    } catch (err) {
      console.warn('Googleカレンダー取得失敗:', err);
    }

    console.log(`勤務種類: ${workType ?? '未設定'}`);
    console.log(`今日のタスク: ${tasks.length}件`);
    console.log(`進行中タスク: ${inProgressTasks.length}件`);
    console.log(`今週の残りタスク: ${weekRemainingTasks.length}件`);
    console.log(`今週のnote: ${weeklyNoteCount}本`);

    const message = await generateMorningComment(
      workType,
      tasks,
      inProgressTasks,
      weeklyNoteCount,
      calendarEvents,
      weekRemainingTasks
    );

    await sendLineMessage(message);
    console.log('✅ 毎朝通知が完了しました');
  } catch (err) {
    console.error('❌ 毎朝通知でエラーが発生しました:', err);
    throw err;
  }
}
