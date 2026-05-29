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

export async function fetchWeekRemainingTasks(): Promise<NotionTask[]> {
  const { today, sunday } = thisWeekRange();

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: '日付', date: { on_or_after: today } },
        { property: '日付', date: { on_or_before: sunday } },
      ],
    },
    page_size: 50,
  });

  return res.results
    .map(pageToTask)
    .filter((t) => t.name !== '' && t.status !== '完了' && t.status !== 'Done')
    .filter((t) => !WORK_TYPES.includes(t.name));
}

export async function fetchTodayWorkType(): Promise<string | null> {
  const today = todayString();

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: '日付', date: { equals: today } },
  });

  for (const page of res.results) {
    const name = getTitle((page as any).properties['名前']);
    if (WORK_TYPES.includes(name)) return name;
  }
  return null;
}

export async function resetDailyTasks(): Promise<void> {
  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: '毎日', checkbox: { equals: true } },
  });

  let resetCount = 0;
  for (const page of res.results) {
    const props = (page as any).properties;
    const status = getStatus(props['状態']);
    if (status === '完了' || status === 'Done') {
      try {
        await (notion.pages.update as any)({
          page_id: page.id,
          properties: {
            '状態': { status: { name: '未着手' } },
          },
        });
        resetCount++;
      } catch {
        try {
          await (notion.pages.update as any)({
            page_id: page.id,
            properties: {
              '状態': { select: { name: '未着手' } },
            },
          });
          resetCount++;
        } catch (e2) {
          console.warn(`タスクリセット失敗 (${page.id}):`, e2);
        }
      }
    }
  }
  console.log(`✅ 毎日タスクをリセットしました（${resetCount}件）`);
}

export async function fetchWeeklyNoteCount(): Promise<number> {
  const { monday, today } = thisWeekRange();

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: '日付', date: { on_or_after: monday } },
        { property: '日付', date: { on_or_before: today } },
      ],
    },
    page_size: 100,
  });

  return res.results
    .map(pageToTask)
    .filter(
      (t) =>
        (t.status === '完了' || t.status === 'Done') &&
        (t.name.includes('note') || t.name.includes('Note'))
    ).length;
}

export async function fetchWeeklyStats(): Promise<WeeklyStats> {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: '日付', date: { on_or_after: mondayStr } },
        { property: '日付', date: { on_or_before: sundayStr } },
      ],
    },
    page_size: 100,
  });

  const tasks = res.results.map(pageToTask);
  const completed = tasks.filter(
    (t) => t.status === '完了' || t.status === 'Done' || t.status === 'done'
  );

  const workTypesSet: string[] = tasks
    .map((t) => t.name)
    .filter((name) => WORK_TYPES.includes(name));

  return {
    completedCount: completed.length,
    noraVideos: completed.filter((t) => t.name.includes('ノーラ')).length,
    monaVideos: completed.filter((t) => t.name.includes('モナ')).length,
    noteCount: completed.filter((t) => t.name.includes('note') || t.name.includes('Note')).length,
    evolutionMinutes: completed.filter((t) => t.name.toLowerCase().includes('evolution')).length * 60,
    xPostCount: completed.filter((t) => t.name.includes('X投稿')).length,
    affirmationDays: completed.filter((t) => t.name.includes('アファメーション') || t.name.includes('アフォメーション')).length,
    normalWorkDays: workTypesSet.filter((w) => w === '通常勤務').length,
    nightShiftCount: workTypesSet.filter((w) => w === '平日当直' || w === '土日当直').length,
    morningShiftCount: workTypesSet.filter((w) => w === '早番').length,
    afterNightShiftDays: workTypesSet.filter((w) => w === '当直明け').length,
    heavyTaskCount: completed.filter((t) => t.weight === '重').length,
    workTypes: workTypesSet,
    taskNames: completed.map((t) => t.name),
  };
}

export async function fetchMonthlyStats(): Promise<MonthlyStats> {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  const firstDayStr = firstDay.toISOString().slice(0, 10);
  const lastDayStr = lastDay.toISOString().slice(0, 10);

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: '日付', date: { on_or_after: firstDayStr } },
        { property: '日付', date: { on_or_before: lastDayStr } },
      ],
    },
    page_size: 100,
  });

  const tasks = res.results.map(pageToTask);
  const completed = tasks.filter(
    (t) => t.status === '完了' || t.status === 'Done'
  );

  const workTypesSet: string[] = tasks
    .map((t) => t.name)
    .filter((name) => WORK_TYPES.includes(name));

  const monthName = `${firstDay.getMonth() + 1}月`;

  return {
    monthName,
    completedCount: completed.length,
    noraVideos: completed.filter((t) => t.name.includes('ノーラ')).length,
    monaVideos: completed.filter((t) => t.name.includes('モナ')).length,
    noteCount: completed.filter((t) => t.name.includes('note') || t.name.includes('Note')).length,
    xPostCount: completed.filter((t) => t.name.includes('X投稿')).length,
    affirmationDays: completed.filter((t) => t.name.includes('アファメーション') || t.name.includes('アフォメーション')).length,
    normalWorkDays: workTypesSet.filter((w) => w === '通常勤務').length,
    nightShiftCount: workTypesSet.filter((w) => w === '平日当直' || w === '土日当直').length,
    morningShiftCount: workTypesSet.filter((w) => w === '早番').length,
    afterNightShiftDays: workTypesSet.filter((w) => w === '当直明け').length,
    heavyTaskCount: completed.filter((t) => t.weight === '重').length,
  };
}
