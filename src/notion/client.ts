import { Client } from '@notionhq/client';
import { NotionTask, WeeklyStats, MonthlyStats } from '../types';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

const WORK_TYPES = ['通常勤務', '早番', '平日当直', '土日当直', '当直明け', '休み'];

function getTitle(prop: any): string {
  return prop?.title?.[0]?.plain_text ?? '';
}

function getStatus(prop: any): string {
  return prop?.status?.name ?? prop?.select?.name ?? '';
}

function getCheckbox(prop: any): boolean {
  return prop?.checkbox ?? false;
}

function getSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}

function getDate(prop: any): string | null {
  return prop?.date?.start ?? null;
}

function pageToTask(page: any): NotionTask {
  const props = page.properties;
  const name = getTitle(props['名前']);
  const workTypeFromTitle = WORK_TYPES.includes(name) ? name : getSelect(props['勤務']);
  return {
    id: page.id,
    name,
    date: getDate(props['日付']),
    status: getStatus(props['状態']),
    isDaily: getCheckbox(props['毎日']),
    weight: getSelect(props['重さ']),
    priority: getSelect(props['優先度']),
    workType: workTypeFromTitle,
  };
}

function todayString(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.toISOString().slice(0, 10);
}

function tomorrowString(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  jst.setDate(jst.getDate() + 1);
  return jst.toISOString().slice(0, 10);
}

function thisWeekRange(): { monday: string; sunday: string; today: string } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
    today: now.toISOString().slice(0, 10),
  };
}

export async function fetchTodayTasks(): Promise<NotionTask[]> {
  const today = todayString();

  const [byDate, byDaily] = await Promise.all([
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '日付', date: { equals: today } },
    }),
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '毎日', checkbox: { equals: true } },
    }),
  ]);

  const allPages = [...byDate.results, ...byDaily.results];
  const seen = new Set<string>();
  const unique = allPages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique
    .map(pageToTask)
    .filter((t) => t.name !== '' && t.status !== '完了' && t.status !== 'Done')
    .filter((t) => !WORK_TYPES.includes(t.name));
}

export async function fetchTodayCompletedTasks(): Promise<NotionTask[]> {
  const today = todayString();

  const [byDate, byDaily] = await Promise.all([
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '日付', date: { equals: today } },
    }),
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '毎日', checkbox: { equals: true } },
    }),
  ]);

  const allPages = [...byDate.results, ...byDaily.results];
  const seen = new Set<string>();
  const unique = allPages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique
    .map(pageToTask)
    .filter((t) => t.name !== '' && (t.status === '完了' || t.status === 'Done'))
    .filter((t) => !WORK_TYPES.includes(t.name));
}

export async function fetchTodayInProgressTasks(): Promise<NotionTask[]> {
  const today = todayString();

  const [byDate, byDaily] = await Promise.all([
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '日付', date: { equals: today } },
    }),
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: '毎日', checkbox: { equals: true } },
    }),
  ]);

  const allPages = [...byDate.results, ...byD
