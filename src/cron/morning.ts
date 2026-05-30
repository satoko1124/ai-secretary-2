import { fetchTodayTasks, fetchTodayWorkType, resetDailyTasks, fetchWeeklyNoteCount, fetchWeekRemainingTasks } from '../notion/client';
import { fetchWorkTypeFromCalendar, fetchTodayCalendarEvents } from '../google/calendar';
import { generateMorningComment } from '../gemini/comment';
import { sendLineMessage } from '../line/sender';
import { selectOneAction, Task } from '../claude/oneAction';

export async function runMorningNotification(): Promise<void> {
  console.log('🌅 毎朝通知を開始します...');
  try {
    await resetDailyTasks();

    const [tasks, notionWorkType, weeklyNoteCount, weekRemainingTasks] = await Promise.all([
      fetchTodayTasks(),
      fetchTodayWorkType(),
      fetchWeeklyNoteCount(),
      fetchWeekRemainingTasks(),
    ]);

    let workType = notionWorkType;
    let calendarEvents: any[] = [];
    try {
      const [calWorkType, events] = await Promise.all([
        fetchWorkTypeFromCalendar(),
        fetchTodayCalendarEvents(),
      ]);
      if (calWorkType) workType = calWorkType;
      calendarEvents = events.filter((e) => !e.isWorkType);
      console.log(`Googleカレンダー予定: ${calendarEvents.length}件`);
    } catch (err) {
      console.warn('Googleカレンダー取得失敗（Notionで代替）:', err);
    }

    console.log(`勤務種類: ${workType ?? '未設定'}`);
    console.log(`今日のタスク: ${tasks.length}件`);
    console.log(`今週の残りタスク: ${weekRemainingTasks.length}件`);
    console.log(`今週のnote: ${weeklyNoteCount}本`);

    const message = await generateMorningComment(
      workType,
      tasks,
      weeklyNoteCount,
      calendarEvents,
      weekRemainingTasks
    );

    const oneActionTasks: Task[] = tasks.map((t: any) => ({
      id: t.id,
      name: t.name,
      weight: (t.weight ?? '軽') as '軽' | '中' | '重',
      priority: t.priority ?? undefined,
      status: t.status,
      isDaily: t.isDaily ?? false,
    }));

    const oneAction = await selectOneAction({
      tasks: oneActionTasks,
      workType: workType ?? '通常勤務',
      todayDate: new Date().toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    });

    await sendLineMessage(message);
    await sendLineMessage(oneAction.message);

    console.log('✅ 毎朝通知が完了しました');
  } catch (err) {
    console.error('❌ 毎朝通知でエラーが発生しました:', err);
    throw err;
  }
}
