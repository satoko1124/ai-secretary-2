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
  return {
    id: page.id,
    name,
    date: getDate(props['日付']),
    status: getStatus(props['状態']),
    isDaily: getCheckbox(props['毎日']),
    weight: getSelect(props['重さ']),
    priority: getSelect(props['優先度']),
    workType: null,
  };
}

function todayString(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function tomorrowString(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() + 1);
  return jst.toISOString().slice(0, 10);
}

function thisWeekRange(): { monday: string; sunday: string; today: string } {
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
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

  const allPages = [...byDate.results, ...byDaily.results];
  const seen = new Set<string>();
  const unique = allPages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique
    .map(pageToTask)
    .filter((t) => t.name !== '' && t.status !== '完了' && t.status !== 'Done' && t.status !== '未着手')
    .filter((t) => !WORK_TYPES.includes(t.name));
}

export async function fetchTomorrowInfo(): Promise<NotionTask[]> {
  const tomorrow = tomorrowString();

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: '日付', date: { equals: tomorrow } },
  });

  return res.results
    .map(pageToTask)
    .filter((t) => t.name !== '')
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
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

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

  return {
    completedCount: completed.length,
    noraVideos: completed.filter((t) => t.name.includes('ノーラ')).length,
    monaVideos: completed.filter((t) => t.name.includes('モナ')).length,
    noteCount: completed.filter((t) => t.name.includes('note') || t.name.includes('Note')).length,
    evolutionMinutes: completed.filter((t) => t.name.toLowerCase().includes('evolution')).length * 60,
    xPostCount: completed.filter((t) => t.name.includes('X投稿') || t.name.includes('Xに投稿')).length,
    affirmationDays: completed.filter((t) => t.name.includes('アファメーション') || t.name.includes('アフォメーション')).length,
    normalWorkDays: 0,
    nightShiftCount: 0,
    morningShiftCount: 0,
    afterNightShiftDays: 0,
    heavyTaskCount: completed.filter((t) => t.weight === '重').length,
    workTypes: [],
    taskNames: completed.map((t) => t.name),
  };
}

export async function fetchMonthlyStats(): Promise<MonthlyStats> {
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);

  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));

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

  const monthName = `${firstDay.getUTCMonth() + 1}月`;

  return {
    monthName,
    completedCount: completed.length,
    noraVideos: completed.filter((t) => t.name.includes('ノーラ')).length,
    monaVideos: completed.filter((t) => t.name.includes('モナ')).length,
    noteCount: completed.filter((t) => t.name.includes('note') || t.name.includes('Note')).length,
    xPostCount: completed.filter((t) => t.name.includes('X投稿') || t.name.includes('Xに投稿')).length,
    affirmationDays: completed.filter((t) => t.name.includes('アファメーション') || t.name.includes('アフォメーション')).length,
    normalWorkDays: 0,
    nightShiftCount: 0,
    morningShiftCount: 0,
    afterNightShiftDays: 0,
    heavyTaskCount: completed.filter((t) => t.weight === '重').length,
  };
}

export async function completeNotionTask(taskName: string): Promise<void> {
  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: '名前', title: { contains: taskName } },
  });

  if (res.results.length === 0) throw new Error('タスクが見つかりません');

  const page = res.results[0];
  try {
    await (notion.pages.update as any)({
      page_id: page.id,
      properties: {
        '状態': { status: { name: '完了' } },
      },
    });
  } catch {
    await (notion.pages.update as any)({
      page_id: page.id,
      properties: {
        '状態': { select: { name: '完了' } },
      },
    });
  }
}

export async function addNotionTask(taskName: string): Promise<void> {
  const today = todayString();
  await (notion.pages.create as any)({
    parent: { database_id: DATABASE_ID },
    properties: {
      '名前': { title: [{ text: { content: taskName } }] },
      '日付': { date: { start: today } },
      '状態': { select: { name: '未着手' } },
    },
  });
}
