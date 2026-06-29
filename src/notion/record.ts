const RECORD_DATABASE_ID = process.env.NOTION_RECORD_DATABASE_ID!;
const NOTION_API_KEY = process.env.NOTION_API_KEY!;

const headers = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

// ===== 共通: 記録追加 =====
async function addRecord(name: string, type: '生理' | '体調' | 'メモ' | '進捗'): Promise<void> {
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const body = {
    parent: { database_id: RECORD_DATABASE_ID },
    properties: {
      名前: {
        title: [{ text: { content: name } }],
      },
      日付: {
        date: { start: today },
      },
      選択: {
        select: { name: type },
      },
    },
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion APIエラー: ${err}`);
  }

  console.log(`記録を追加しました: ${name} (${type}, ${today})`);
}

// ===== 体調不良 =====
export async function addConditionRecord(note: string = ''): Promise<void> {
  const name = note ? `体調不良：${note}` : '体調不良';
  await addRecord(name, '体調');
}

export async function checkTodayConditionBad(): Promise<boolean> {
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${RECORD_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          and: [
            { property: '選択', select: { equals: '体調' } },
            { property: '日付', date: { equals: today } },
          ],
        },
      }),
    });
    const data = await res.json() as any;
    return (data.results ?? []).length > 0;
  } catch (err) {
    console.error('体調確認エラー:', err);
    return false;
  }
}

// ===== メモ =====
export async function addMemoRecord(content: string): Promise<void> {
  await addRecord(`メモ：${content}`, 'メモ');
}

// ===== 進捗 =====
export async function addProgressRecord(taskName: string, content: string): Promise<void> {
  await addRecord(`${taskName}：${content}`, '進捗');
}

export async function getTodayProgressRecords(): Promise<string[]> {
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${RECORD_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          and: [
            { property: '選択', select: { equals: '進捗' } },
            { property: '日付', date: { equals: today } },
          ],
        },
      }),
    });
    const data = await res.json() as any;
    return (data.results ?? []).map((page: any) =>
      page.properties?.名前?.title?.[0]?.plain_text ?? ''
    ).filter(Boolean);
  } catch (err) {
    console.error('進捗取得エラー:', err);
    return [];
  }
}

// ===== 生理 =====
export interface PeriodRecord {
  date: string;
  day: number;
}

export async function addPeriodRecord(day: number): Promise<void> {
  await addRecord(`生理${day}日目`, '生理');
}

export async function getLatestPeriodRecord(): Promise<PeriodRecord | null> {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${RECORD_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: '選択', select: { equals: '生理' },
        },
        sorts: [{ property: '日付', direction: 'descending' }],
        page_size: 1,
      }),
    });
    const data = await res.json() as any;
    const results = data.results ?? [];
    if (results.length === 0) return null;

    const page = results[0];
    const date = page.properties?.日付?.date?.start ?? null;
    const name = page.properties?.名前?.title?.[0]?.plain_text ?? '';
    const dayMatch = name.match(/生理(\d+)日目/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 1;

    return date ? { date, day } : null;
  } catch (err) {
    console.error('生理記録取得エラー:', err);
    return null;
  }
}

export interface PeriodStatus {
  currentDay: number | null;
  nextPeriodDate: string | null;
  daysUntilNext: number | null;
  phase: 'period' | 'pms' | 'normal';
}

export async function getPeriodStatus(cycleLength: number = 28): Promise<PeriodStatus> {
  const latest = await getLatestPeriodRecord();
  if (!latest) {
    return { currentDay: null, nextPeriodDate: null, daysUntilNext: null, phase: 'normal' };
  }

  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  today.setHours(0, 0, 0, 0);
  const latestDate = new Date(latest.date);
  latestDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentDay = latest.day + diffDays;

  const firstDayDate = new Date(latestDate);
  firstDayDate.setDate(firstDayDate.getDate() - (latest.day - 1));
  const nextPeriod = new Date(firstDayDate);
  nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
  const daysUntilNext = Math.round((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const nextPeriodDate = nextPeriod.toISOString().slice(0, 10);

  let phase: 'period' | 'pms' | 'normal' = 'normal';
  if (currentDay >= 1 && currentDay <= 7) {
    phase = 'period';
  } else if (daysUntilNext <= 3 && daysUntilNext >= 0) {
    phase = 'pms';
  }

  return {
    currentDay: currentDay <= 7 ? currentDay : null,
    nextPeriodDate,
    daysUntilNext,
    phase,
  };
}
