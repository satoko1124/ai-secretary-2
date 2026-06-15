import { google } from 'googleapis';

const WORK_TYPES = [
  '通常勤務',
  '早番',
  '当直明け',
  '休み',
  '当直',
  '日直',
];

const TOCHU_TYPES = ['当直'];

export interface CalendarEvent {
  title: string;
  start: string;
  isWorkType: boolean;
  workType: string | null;
}

async function getCalendarClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません');
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  return google.calendar({ version: 'v3', auth });
}

function getJSTDateString(offsetDays: number = 0): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() + offsetDays);
  return jst.toISOString().slice(0, 10);
}

async function fetchCalendarEventsForDate(dateStr: string): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID が設定されていません');
  const calendar = await getCalendarClient();
  const startOfDay = new Date(`${dateStr}T00:00:00+09:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59+09:00`);
  console.log(`日付(JST): ${dateStr}`);
  console.log(`カレンダー取得範囲: ${startOfDay.toISOString()} 〜 ${endOfDay.toISOString()}`);
  const res = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items ?? [];
  console.log(`取得したイベント数: ${events.length}`);
  events.forEach(e => console.log(`イベント: ${e.summary}`));
  return events.map((event) => {
    const title = event.summary ?? '';
    const workType = WORK_TYPES.find((w) => title.includes(w)) ?? null;
    console.log(`タイトル:「${title}」→ workType:「${workType}」`);
    return {
      title,
      start: event.start?.dateTime ?? event.start?.date ?? '',
      isWorkType: workType !== null,
      workType,
    };
  });
}

async function checkIfTochuAke(dateStr: string): Promise<boolean> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return false;
  const calendar = await getCalendarClient();

  const prevDayStart = new Date(`${dateStr}T00:00:00+09:00`);
  prevDayStart.setDate(prevDayStart.getDate() - 1);
  const targetDayStart = new Date(`${dateStr}T00:00:00+09:00`);

  const res = await calendar.events.list({
    calendarId,
    timeMin: prevDayStart.toISOString(),
    timeMax: targetDayStart.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items ?? [];
  for (const event of events) {
    const title = event.summary ?? '';
    const isTochuType = TOCHU_TYPES.some((w) => title.includes(w));
    if (!isTochuType) continue;

    const endStr = event.end?.dateTime ?? event.end?.date ?? '';
    if (!endStr) continue;
    const endDate = new Date(endStr);
    const targetDate = new Date(`${dateStr}T00:00:00+09:00`);
    if (endDate > targetDate) {
      console.log(`当直明け判定: 前日の「${title}」が${dateStr}まで続いている`);
      return true;
    }
  }
  return false;
}

async function getEventsWithTochuAke(dateStr: string): Promise<CalendarEvent[]> {
  const events = await fetchCalendarEventsForDate(dateStr);
  const isTochuAke = await checkIfTochuAke(dateStr);

  if (isTochuAke) {
    console.log(`${dateStr}は当直明けと判定しました`);
    const hasWorkType = events.some((e) => e.isWorkType);
    if (hasWorkType) {
      return events.map((e) =>
        e.isWorkType ? { ...e, workType: '当直明け' } : e
      );
    } else {
      return [
        { title: '当直明け', start: '', isWorkType: true, workType: '当直明け' },
        ...events,
      ];
    }
  }

  // 勤務イベントがない場合は「休み」として扱う
  const hasWorkType = events.some((e) => e.isWorkType);
  if (!hasWorkType) {
    console.log(`${dateStr}は勤務イベントなし → 休みと判定`);
    return [
      { title: '休み', start: '', isWorkType: true, workType: '休み' },
      ...events,
    ];
  }

  // 複数の勤務イベントがある場合、開始時刻が最も遅いものを優先
  const workEvents = events.filter((e) => e.isWorkType);
  if (workEvents.length > 1) {
    console.log(`複数の勤務イベントあり: ${workEvents.map(e => e.workType).join(', ')}`);
    const latestWorkEvent = workEvents.reduce((latest, current) => {
      return current.start > latest.start ? current : latest;
    });
    console.log(`優先する勤務: ${latestWorkEvent.workType}`);
    return events.map((e) =>
      e.isWorkType && e !== latestWorkEvent
        ? { ...e, isWorkType: false }
        : e
    );
  }

  return events;
}

export async function fetchTodayCalendarEvents(): Promise<CalendarEvent[]> {
  const todayStr = getJSTDateString(0);
  return getEventsWithTochuAke(todayStr);
}

export async function fetchTomorrowCalendarEvents(): Promise<CalendarEvent[]> {
  const tomorrowStr = getJSTDateString(1);
  return getEventsWithTochuAke(tomorrowStr);
}

export async function fetchWorkTypeFromCalendar(): Promise<string | null> {
  try {
    const events = await fetchTodayCalendarEvents();
    const workEvent = events.find((e) => e.isWorkType);
    console.log(`勤務種別(calendar.ts内): ${workEvent?.workType ?? 'null'}`);
    return workEvent?.workType ?? null;
  } catch (err) {
    console.warn('Googleカレンダーからの勤務取得に失敗:', err);
    return null;
  }
}
