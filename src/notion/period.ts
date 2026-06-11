const PERIOD_DATABASE_ID = process.env.NOTION_PERIOD_DATABASE_ID!;
const NOTION_API_KEY = process.env.NOTION_API_KEY!;

const headers = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

export interface PeriodRecord {
  date: string;
  day: number;
}

// 最新の生理記録を取得
export async function getLatestPeriodRecord(): Promise<PeriodRecord | null> {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${PERIOD_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sorts: [{ property: 'Date', direction: 'descending' }],
        page_size: 1,
      }),
    });
    const data = await res.json() as any;
    const results = data.results ?? [];
    if (results.length === 0) return null;

    const page = results[0];
    const date = page.properties?.Date?.date?.start ?? null;
    const name = page.properties?.Name?.title?.[0]?.plain_text ?? '';
    const dayMatch = name.match(/生理(\d+)日目/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 1;

    return date ? { date, day } : null;
  } catch (err) {
    console.error('生理記録取得エラー:', err);
    return null;
  }
}

// 生理記録を追加
export async function addPeriodRecord(day: number): Promise<void> {
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: PERIOD_DATABASE_ID },
      properties: {
        Name: {
          title: [{ text: { content: `生理${day}日目` } }],
        },
        Date: {
          date: { start: today },
        },
      },
    }),
  });
  console.log(`生理${day}日目を記録しました（${today}）`);
}

// 生理周期の状態を計算
export interface PeriodStatus {
  currentDay: number | null;      // 今日が生理何日目か（nullなら生理中でない）
  nextPeriodDate: string | null;  // 次回予定日
  daysUntilNext: number | null;   // 次回まで何日
  phase: 'period' | 'pms' | 'normal'; // 現在のフェーズ
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

  // 最新記録からの経過日数
  const diffDays = Math.round((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentDay = latest.day + diffDays;

  // 次回予定日（1日目から28日後）
  const firstDayDate = new Date(latestDate);
  firstDayDate.setDate(firstDayDate.getDate() - (latest.day - 1));
  const nextPeriod = new Date(firstDayDate);
  nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
  const daysUntilNext = Math.round((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const nextPeriodDate = nextPeriod.toISOString().slice(0, 10);

  // フェーズ判定
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
