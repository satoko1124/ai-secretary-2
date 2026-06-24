import { NotionTask, WeeklyStats, MonthlyStats } from '../types';
import { PeriodStatus } from '../notion/record';

const BASE_SYSTEM_PROMPT = `
あなたは「秘書ちゃん」です。未来を変える行動を支援します。

【ミッション】
「いつかやろう」を「今日やる」に変えること。

【未来を変える行動とは】
重要だけど緊急ではないこと。
・Evolution動画視聴・まとめ
・将来への投資・仕組みづくり

【ユーザー情報】
病院勤務をしながら創作活動・学習・発信を継続している。
朝型で、朝の高集中時間が最も価値が高い資源。
昼以降は脳疲労が出やすく、夜は重タスクに向かない。
秋田県在住。出張や旅行で他県に行くこともある。
カレンダーの予定に地名が含まれている場合、その場所にいると判断する。

【勤務パターン】
・通常勤務：8:30〜17:00
・早番：8:00〜16:30
・当直：17:00〜翌8:30（院内Wi-Fiが不安定なためデジタル作業は避ける。アナログ作業を推奨）
・当直明け：回復最優先。未来を変える行動はアナログ作業のみ（手書きメモ・思考整理）。デジタル作業は翌日に回す。横になる時間を確保することが明日への投資。
・日直：8:30〜17:00
・休み：未来を変える行動に最も集中できる日

【タスク分類】
重タスク（未来を変える行動）：Evolution動画視聴・Evolution動画まとめ
軽タスク（ルーティーン）：ノーラ動画・X投稿・アファメーション・アメブロ執筆・日経225

【今日の状態の判断基準】
攻める日：休日・通常勤務帰宅後・早番帰宅後（体力あり）
維持する日：通常勤務帰宅後（疲労あり）・早番帰宅後（疲労あり）・日直帰宅後
回復する日：当直明け・当直中・生理1〜3日目・体調不良の日

【当直明けの朝通知に必ず含めること】
・回復を最優先にするメッセージ
・コンビニで買えるおすすめメニューを具体的に提案（体に優しいもの＋少しジャンキーなものも）
・未来を変える行動はアナログ作業のみOKと伝える
・横になる時間を確保することを勧める

【生理中の対応】
・生理前日（PMSフェーズ）：お腹がゆるくなる・頭痛が出やすい。消化に優しい食事と頭痛薬の準備を促す
・生理1〜3日目：腹痛・体調不良あり。回復する日として扱う。無理せず横になることを優先
・生理4日目以降：徐々に回復。軽めの活動からOK
・生理中の朝通知のコンビニおすすめ：温かい飲み物・ゼリー飲料・おかゆ・バナナ・ホットスナック
・食べ物の提案は朝通知のみ。夜通知には含めない

【体調不良の対応】
・「体調：不良」が記録された日は回復する日として扱う
・未来を変える行動は完全に休んでOK。何もしないことが今日の成功
・コンビニで体に優しいものを提案する
・無理せず横になることを優先

【当直明け・生理・体調不良が重なった場合】
・当直明けを最優先にする
・他のアドバイスは翌日以降にする
・コンビニメニューは当直明け用のものを使う

【行動原則】
- ユーザーを責めない
- 気合い論・精神論を使わない
- 未来を変える行動が1ミリでも前進することが成功
- ルーティーンは「通常通りで大丈夫」と一言でよい
- アスタリスク（*）を使わない
- タスク名の後ろに重さ（軽・中・重）を表記しない
`.trim();

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: BASE_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude APIエラー: ${err}`);
  }

  const data = await res.json() as any;
  return data.content?.[0]?.text ?? '（コメント生成失敗）';
}

export async function generateMorningComment(
  workType: string | null,
  tasks: NotionTask[],
  inProgressTasks: NotionTask[],
  calendarEvents: any[] = [],
  periodStatus?: PeriodStatus,
  conditionBad: boolean = false,
): Promise<string> {
  const heavyTasks = [...inProgressTasks, ...tasks].filter((t) => t.weight === '重');
  const mediumTasks = [...inProgressTasks, ...tasks].filter((t) => t.weight === '中');
  const allSecondQuadrantTasks = [...new Map([...heavyTasks, ...mediumTasks].map(t => [t.id, t])).values()];

  const calendarList = calendarEvents.length > 0
    ? calendarEvents.map((e: any) => `・${e.title}`).join('\n')
    : 'なし';

  const secondQuadrantList = allSecondQuadrantTasks.length > 0
    ? allSecondQuadrantTasks.map((t) => `・${t.name}（${t.status === '進行中' ? '進行中' : '未着手'}）`).join('\n')
    : 'なし';

  let periodInfo = '記録なし';
  if (periodStatus) {
    if (periodStatus.phase === 'period' && periodStatus.currentDay) {
      periodInfo = `生理${periodStatus.currentDay}日目`;
    } else if (periodStatus.phase === 'pms' && periodStatus.daysUntilNext !== null) {
      periodInfo = `生理予定まであと${periodStatus.daysUntilNext}日（PMSに注意）`;
    } else if (periodStatus.daysUntilNext !== null) {
      periodInfo = `次回生理予定まであと${periodStatus.daysUntilNext}日`;
    }
  }

  const conditionInfo = conditionBad ? '体調不良が記録されています' : '記録なし';

  const prompt = `
今日の状況を分析して、毎朝のLINE通知を生成してください。

【今日の勤務】
${workType ?? '未設定（休日の可能性）'}

【Googleカレンダーの予定】
${calendarList}

【未来を変える行動タスク（重・中）】
${secondQuadrantList}

【生理・体調情報】
${periodInfo}

【体調不良記録】
${conditionInfo}

以下のフォーマットで出力してください：

おはようございます ☀️

【勤務】
（勤務種類）

【今日の予定】
（Googleカレンダーの予定があれば記載、なければ省略）

【体調】
（生理中・PMS・体調不良のいずれかがある場合のみ記載。当直明けと重なった場合は省略）

【今日の状態】
（攻める日 / 維持する日 / 回復する日）

【本日の未来を変える行動】
（今日進めるべきタスクを1つだけ選ぶ。進行中のものを優先する。当直明け・生理1〜3日目・体調不良はアナログ作業のみ、または完全休養でもOK。カレンダーに地名がある場合はその場所での行動を考慮する）

【推奨時間】
（今日の勤務パターンとカレンダー予定を考慮して、具体的な時間帯を提案。出張・外出がある場合はその前後の時間を提案）

【今日の成功条件】
（何分・どこまで進めるか。小さくてOK。体調不良の場合は「何もしないことが成功」でもよい）

（当直明けの場合は【回復メニュー】として当直明け用コンビニおすすめを追加する。生理1〜3日目または体調不良のみの場合は【回復メニュー】として体に優しいコンビニおすすめを追加する。当直明けと他が重なった場合は当直明けを優先し他のアドバイスは省略する）

ルーティーンは通常通りで大丈夫です。
`.trim();

  return callClaude(prompt);
}

export async function generateEveningComment(
  workType: string | null,
  completedTasks: NotionTask[],
  inProgressTasks: NotionTask[],
  tomorrowTasks: NotionTask[],
  tomorrowCalendarEvents: any[] = []
): Promise<string> {
  const completedSecondQuadrant = completedTasks.filter(
    (t) => t.weight === '重' || t.weight === '中'
  );
  const completedList = completedTasks.length > 0
    ? completedTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const inProgressList = inProgressTasks.length > 0
    ? inProgressTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const tomorrowWorkType = tomorrowCalendarEvents.find((e: any) => e.isWorkType)?.workType ?? null;
  const tomorrowCalList = tomorrowCalendarEvents.filter((e: any) => !e.isWorkType).length > 0
    ? tomorrowCalendarEvents.filter((e: any) => !e.isWorkType).map((e: any) => `・${e.title}`).join('\n')
    : 'なし';

  const prompt = `
今日の振り返りと明日の準備のLINE通知を生成してください。
タスク名の後ろに重さを表記しないでください。
アスタリスク（*）を使わないでください。
食べ物・コンビニの提案は絶対に含めないでください。
ユーザーは秋田県在住です。カレンダーの予定に地名が含まれている場合、その場所にいると判断してください。

【今日の勤務】
${workType ?? '未設定'}

【今日完了したタスク】
${completedList}

【今日進めた未来を変える行動】
${completedSecondQuadrant.length > 0
  ? completedSecondQuadrant.map((t) => `・${t.name}`).join('\n')
  : 'なし'}

【進行中タスク】
${inProgressList}

【明日の勤務】
${tomorrowWorkType ?? '未設定'}

【明日のカレンダー予定】
${tomorrowCalList}

以下のフォーマットで出力してください：

おつかれさまです 🌙

【今日の完了】
（完了タスク一覧。タスク名のみ）

【未来を変える行動の進捗】
（今日進んだ場合は褒める。進まなかった場合は責めずに明日へつなげる）

【進行中】
（進行中タスクがあれば記載、なければ省略）

【明日の予定】
勤務：（明日の勤務種別）
カレンダー：（予定があれば記載、なければ省略）

AI秘書からひとこと：
（明日の勤務とカレンダー予定を考慮して、明日の未来を変える行動をいつ・どう進めるか一言。2文以内。責めない。明日が当直明けの場合は回復を優先するメッセージにする。食べ物の提案は含めない。カレンダーに地名がある場合はその場所での状況を考慮する）
`.trim();

  return callClaude(prompt);
}

export async function generateWeeklyComment(stats: WeeklyStats): Promise<string> {
  const prompt = `
今週の活動データを分析して、週報LINEメッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。

【今週の未来を変える行動の実績】
・evolution学習：${Math.round(stats.evolutionMinutes / 60)}時間
・重タスク完了：${stats.heavyTaskCount}個

【今週のルーティーン実績】
・ノーラ動画：${stats.noraVideos}本
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日
・完了タスク総数：${stats.completedCount}個

以下のフォーマットで出力してください：

今週の週報 📊

おつかれさまでした ☀️

■ 未来を変える行動の進捗
（Evolution学習の実績。達成を讃える。未達でも責めない）

■ ルーティーン
（軽タスクの継続状況を一言で）

■ 来週の未来を変える行動
（来週進めるべきことを1〜2点。具体的に）
`.trim();

  return callClaude(prompt);
}

export async function generateMonthlyComment(stats: MonthlyStats): Promise<string> {
  const prompt = `
先月の活動データを分析して、月報LINEメッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。

【${stats.monthName}の未来を変える行動の実績】
・重タスク完了：${stats.heavyTaskCount}個

【${stats.monthName}のルーティーン実績】
・ノーラ動画：${stats.noraVideos}本
・モナ動画：${stats.monaVideos}本
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日
・完了タスク総数：${stats.completedCount}個

以下のフォーマットで出力してください：

${stats.monthName}の月報 📅

おつかれさまでした ☀️

■ 未来を変える行動の進捗
（Evolution学習の月次実績。達成を讃える。未達でも責めない）

■ ルーティーンの継続
（軽タスクの継続状況を一言で）

■ 来月の未来を変える行動目標
（具体的な提案を2点。箇条書きは「・」を使う）
`.trim();

  return callClaude(prompt);
}
