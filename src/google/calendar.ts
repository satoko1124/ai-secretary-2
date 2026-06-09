import { google } from 'googleapis';

const WORK_TYPES = [
  '通常勤務',
  '早番',
  '平日当直',
  '土日当直',
  '当直明け',
  '休み',
  '当直',  // 「当直」のみの入力にも対応
];

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

  console.log(`今日の日付(JST): ${dateStr}`);
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
    return {
      title,
      start: event.start?.dateTime ?? event.start?.date ?? '',
      isWorkType: workType !== null,
      workType,
    };
  });
}

export async function fetchTodayCalendarEvents(): Promise<CalendarEvent[]> {
  const todayStr = getJSTDateString(0);
  return fetchCalendarEventsForDate(todayStr);
}

export async function fetchTomorrowCalendarEvents(): Promise<CalendarEvent[]> {
  const tomorrowStr = getJSTDateString(1);
  return fetchCalendarEventsForDate(tomorrowStr);
}

export async function fetchWorkTypeFromCalendar(): Promise<string | null> {
  try {
    const events = await fetchTodayCalendarEvents();
    const workEvent = events.find((e) => e.isWorkType);
    return workEvent?.workType ?? null;
  } catch (err) {
    console.warn('Googleカレンダーからの勤務取得に失敗:', err);
    return null;
  }
}
