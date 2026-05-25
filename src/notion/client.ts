import { Client } from '@notionhq/client';
import { NotionTask, WeeklyStats } from '../types';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

// プロパティ値を安全に取得するユーティリティ
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

// Notionのページを NotionTask 型に変換
function pageToTask(page: any): NotionTask {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props['名前']),
    date: getDate(props['日付']),
    status: getStatus(props['状態']),
    isDaily: getCheckbox(props['毎日']),
    weight: getSelect(props['重さ']),
    priority: getSelect(props['優先度']),
    workType: getSelect(props['勤務']),
  };
}

// 今日の日付を YYYY-MM-DD 形式で返す
function todayString(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.toISOString().slice(0, 10);
}

// 今日のタスクを取得（日付=今日 OR 毎日=true、かつ状態≠完了）
export async function fetchTodayTasks(): Promise<NotionTask[]> {
  const today = todayString();

  const [byDate, byDaily] = await Promise.all([
    // 日付が今日のタスク
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: '日付', date: { equals: today } },
          { property: '状態', status: { does_not_equal: '完了' } },
        ],
      },
    }),
    // 毎日=trueのタスク
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: '毎日', checkbox: { equals: true } },
          { property: '状態', status: { does_not_equal: '完了' } },
        ],
      },
    }),
  ]);

  // 重複排除（id でユニーク化）
  const allPages = [...byDate.results, ...byDaily.results];
  const seen = new Set<string>();
  const unique = allPages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique.map(pageToTask).filter((t) => t.name !== '');
}

// 今日の勤務種類を取得（「勤務」プロパティが設定されたタスクから推定）
export async function fetchTodayWorkType(): Promise<string | null> {
  const today = todayString();

  const res = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: '日付', date: { equals: today } },
        { property: '勤務', select: { is_not_empty: true } },
      ],
    },
    page_size: 1,
  });

  if (res.results.length === 0) return null;
  const page = res.results[0] as any;
  return getSelect(page.properties['勤務']);
}

// 今週（月〜日）の完了タスクを取得して週報用に集計
export async function fetchWeeklyStats(): Promise<WeeklyStats> {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  // 月曜日を週の始まりとする
  const dayOfWeek = now.getDay(); // 0=日, 1=月...
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

  // 完了タスクのみ
  const completed = tasks.filter(
    (t) => t.status === '完了' || t.status === 'Done' || t.status === 'done'
  );

  // 勤務種類の集計（重複OK、日別記録のため）
  const workTypesSet: string[] = tasks
    .map((t) => t.workType)
    .filter((w): w is string => w !== null);

  const stats: WeeklyStats = {
    completedCount: completed.length,
    noraVideos: completed.filter((t) => t.name.includes('ノーラ')).length,
    monaVideos: completed.filter((t) => t.name.includes('モナ')).length,
    noteCount: completed.filter(
      (t) => t.name.includes('note') || t.name.includes('Note') || t.name.includes('ノート')
    ).length,
    evolutionMinutes: completed.filter((t) => t.name.toLowerCase().includes('evolution')).length * 60, // 仮: 1タスク=60分
    xPostCount: completed.filter((t) => t.name.includes('X投稿') || t.name.includes('ツイート')).length,
    affirmationDays: completed.filter((t) => t.name.includes('アファメーション')).length,
    normalWorkDays: workTypesSet.filter((w) => w === '通常勤務').length,
    nightShiftCount: workTypesSet.filter((w) => w === '平日当直' || w === '土日当直').length,
    morningShiftCount: workTypesSet.filter((w) => w === '早番').length,
    afterNightShiftDays: workTypesSet.filter((w) => w === '当直明け').length,
    heavyTaskCount: completed.filter((t) => t.weight === '重').length,
    workTypes: workTypesSet,
    taskNames: completed.map((t) => t.name),
  };

  return stats;
}
