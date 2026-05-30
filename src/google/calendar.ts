import { google } from 'googleapis';

const WORK_TYPES = ['通常勤務', '早番', '平日当直', '土日当直', '当直明け', '休み'];

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

async function fetchCalendarEventsForDate(dateStr: string): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID が設定されていません');

  const calendar = await getCalendarClient();

  const date = new Date(dateStr);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  const res = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items ?? [];

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
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const todayStr = now.toISOString().slice(0, 10);
  return fetchCalendarEventsForDate(todayStr);
}

export async function fetchTomorrowCalendarEvents(): Promise<CalendarEvent[]> {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  now.setDate(now.getDate() + 1);
  const tomorrowStr = now.toISOString().slice(0, 10);
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
