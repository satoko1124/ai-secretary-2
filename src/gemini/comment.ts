import { NotionTask, WeeklyStats, MonthlyStats } from '../types';

const BASE_SYSTEM_PROMPT = `
あなたは「AI秘書」です。
病院勤務をしながら創作活動を継続するユーザーをサポートします。

【ユーザー特性】
- 朝型。午前中に高出力で動きすぎる傾向がある
- 昼以降に疲労で失速しやすい
- 病院勤務（日直・当直・早番あり）
- ノーラの動画は毎日運営中
- 真面目で詰め込みやすい / オーバーワーク傾向あり
- 問題は「頑張り不足」ではなく「高出力運転」であること
- 疲労度が低ければ追加タスクもこなせる

【AI秘書の行動原則】
- ユーザーを責めない
- 気合い論・精神論を使わない
- オーバーワークを防ぐ
- 回復を予定として組み込む
- 継続可能性を最優先する
- アスタリスク（*）を使わない。強調したい場合は「！」や絵文字を使う
- 箇条書きは「・」を使う

【タスク負荷基準】
- 軽：X投稿、アファメーション、SNS確認、ノーラの動画
- 中：note執筆、アメブロ執筆、evolution動画まとめ
- 重：モナの動画編集、evolution動画視聴

【勤務のある日のタスク管理】
- 病院での仕事が主体。創作タスクは補助的に
- 通常勤務：帰宅後に軽〜中タスク1個まで。重タスクは1個まで
- 早番：夕方に軽〜中タスク可。体力次第
- 平日当直：重タスク禁止。軽タスクのみ
- 土日当直：当直前に重タスク1個まで
- 当直明け：回復優先。重タスク非推奨。軽タスクのみ

【休日のタスク管理（脳科学ベース）】
- 起床2〜3時間後：重タスク1個（決断力・集中力ピーク）
- 起床4時間後：創造的タスク（note・企画・アイデア）
- 昼食後：軽タスク（X投稿・SNS確認）
- 午後：中タスク（ノーラ動画・アメブロ）
- 重タスクは午前中1個まで。詰め込み禁止
- 昼に15分の休憩を推奨

【noteの目標】週3本
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
  weeklyNoteCount: number,
  calendarEvents: any[] = [],
  weekRemainingTasks: NotionTask[] = []
): Promise<string> {
  const taskList = tasks.map((t) => `・${t.name}`).join('\n');
  const inProgressList = inProgressTasks.length > 0
    ? inProgressTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const heavyTasks = tasks.filter((t) => t.weight === '重');
  const mediumTasks = tasks.filter((t) => t.weight === '中');
  const noteRemaining = Math.max(0, 3 - weeklyNoteCount);
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = today.getUTCDay();
  const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const calendarList = calendarEvents.length > 0
    ? calendarEvents.map((e: any) => `・${e.title}（${e.start}）`).join('\n')
    : 'なし';
  const isHoliday = workType === '休み' || workType === null;
  const weekTaskList = weekRemainingTasks.length > 0
    ? weekRemainingTasks.map((t: NotionTask) => `・${t.name}`).join('\n')
    : 'なし';

  // 勤務種別ごとの重・中タスク推奨メッセージ
  let taskFocusAdvice = '';
  if (workType === '休み' || workType === null) {
    if (heavyTasks.length > 0) {
      taskFocusAdvice = `今日は休日です。午前中に重タスク「${heavyTasks[0].name}」に集中しましょう。`;
    } else if (mediumTasks.length > 0) {
      taskFocusAdvice = `今日は休日です。中タスク「${mediumTasks[0].name}」をじっくり進めましょう。`;
    }
  } else if (workType === '通常勤務') {
    if (heavyTasks.length > 0) {
      taskFocusAdvice = `帰宅後に余力があれば重タスク「${heavyTasks[0].name}」に取り組めます。`;
    } else if (mediumTasks.length > 0) {
      taskFocusAdvice = `帰宅後に中タスク「${mediumTasks[0].name}」を1つこなせそうです。`;
    }
  } else if (workType === '早番') {
    if (mediumTasks.length > 0) {
      taskFocusAdvice = `早番の日は夕方に中タスク「${mediumTasks[0].name}」が狙い目です。`;
    } else {
      taskFocusAdvice = `早番の日は軽タスクを中心に無理なく進めましょう。`;
    }
  } else if (workType === '平日当直' || workType === '土日当直') {
    taskFocusAdvice = `当直日は重タスクはお休み。軽タスクだけでOKです。`;
  } else if (workType === '当直明け') {
    taskFocusAdvice = `当直明けは回復優先。今日は軽タスクだけにしましょう。`;
  }

  const prompt = `
今日の状況を分析して、毎朝のLINE通知メッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。強調は絵文字や「！」で表現してください。

【今日の勤務】
${workType ?? '未設定'}

【今日は休日か勤務日か】
${isHoliday ? '休日（脳科学ベースのタスク配分を推奨）' : '勤務日（病院勤務が主体。創作タスクは補助的に）'}

【進行中のタスク】
${inProgressList}

【今日のタスク一覧】
${taskList || 'なし'}

【今週の残りタスク（今日以降）】
${weekTaskList}

【重タスク】
${heavyTasks.length}個（${heavyTasks.map((t) => t.name).join('、') || 'なし'}）

【中タスク】
${mediumTasks.length}個（${mediumTasks.map((t) => t.name).join('、') || 'なし'}）

【Googleカレンダーの予定】
${calendarList}

【note進捗】
今週：${weeklyNoteCount}本 / 目標3本
残り：${noteRemaining}本（今週残り${daysLeft}日）

【今日の重・中タスクアドバイス】
${taskFocusAdvice || 'なし'}

以下のフォーマットで出力してください：

おはようございます ☀️

【勤務】
（勤務種類）

【進行中】
（進行中タスクがあれば記載、なければ省略）

【今日の予定】
（タスク名のみ。重さの表記なし）

【カレンダーの予定】
（Googleカレンダーの予定があれば記載、なければ省略）

【今日やるといいタスク】
（中・重タスクを優先して今日できそうなものを1〜2個提案。タスク名のみ）

【重タスク】
（重タスクがあれば名前のみ記載、なければ「今日は重タスクなし」）

📝 note進捗
（今週の本数／目標、残り本数をシンプルに。今日書くべきか一言。アスタリスクなし）

💪 今日の集中ポイント
（勤務種別に応じた重・中タスクへの取り組み方を1〜2文で。アスタリスクなし）

AI秘書からひとこと：
（休日なら脳科学ベースの時間配分も提案。勤務日なら帰宅後の無理のない配分を提案。2〜3文で。責めない。アスタリスクなし）
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
  const completedList = completedTasks.length > 0
    ? completedTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const inProgressList = inProgressTasks.length > 0
    ? inProgressTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const tomorrowTaskList = tomorrowTasks.length > 0
    ? tomorrowTasks.map((t) => `・${t.name}`).join('\n')
    : 'なし';
  const tomorrowCalList = tomorrowCalendarEvents.length > 0
    ? tomorrowCalendarEvents.filter((e: any) => !e.isWorkType).map((e: any) => `・${e.title}（${e.start}）`).join('\n')
    : 'なし';
  const tomorrowWorkType = tomorrowCalendarEvents.find((e: any) => e.isWorkType)?.workType ?? null;

  const completedHeavy = completedTasks.filter((t) => t.weight === '重');
  const completedMedium = completedTasks.filter((t) => t.weight === '中');

  const prompt = `
今日の振り返りと明日の準備のLINE通知メッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。強調は絵文字や「！」で表現してください。

【今日の勤務】
${workType ?? '未設定'}

【今日完了したタスク】
${completedList}

【今日完了した重タスク】
${completedHeavy.length}個（${completedHeavy.map((t) => t.name).join('、') || 'なし'}）

【今日完了した中タスク】
${completedMedium.length}個（${completedMedium.map((t) => t.name).join('、') || 'なし'}）

【進行中・未完了タスク】
${inProgressList}

【明日の勤務】
${tomorrowWorkType ?? '未設定'}

【明日のタスク】
${tomorrowTaskList}

【明日のカレンダー予定】
${tomorrowCalList}

以下のフォーマットで出力してください：

おつかれさまです 🌙

【今日の完了】
（完了タスク一覧。タスク名のみ）

【重・中タスクの達成】
（今日完了した重・中タスクがあれば特記。なければ省略）

【進行中】
（進行中タスクがあれば記載、なければ省略）

【明日の予定】
（明日の勤務・タスク・カレンダー予定）

AI秘書からひとこと：
（今日の頑張りを認める。重・中タスクを完了した場合は特に褒める。明日に向けた無理のないアドバイス。2〜3文。責めない。アスタリスクなし）
`.trim();

  return callClaude(prompt);
}

export async function generateWeeklyComment(stats: WeeklyStats): Promise<string> {
  const noteAchievement = stats.noteCount >= 3 ? '達成！' : `あと${3 - stats.noteCount}本`;

  const prompt = `
今週の活動データを分析して、週報LINEメッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。強調は絵文字や「！」で表現してください。

【今週の実績】
・完了タスク数：${stats.completedCount}個
・ノーラ動画：${stats.noraVideos}本
・note：${stats.noteCount}本（目標3本 ${noteAchievement}）
・evolution学習：${Math.round(stats.evolutionMinutes / 60)}時間
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日
・重タスク完了：${stats.heavyTaskCount}個

以下のフォーマットで出力してください：

今週の週報 📊

おつかれさまでした ☀️

■ 完了
（実績一覧）

■ AI分析
（2〜4文。反省会にしない。頑張りを可視化する。重・中タスクの達成も評価する。アスタリスクなし）

■ 来週の提案
（2〜3点。箇条書きは「・」を使う）
`.trim();

  return callClaude(prompt);
}

export async function generateMonthlyComment(stats: MonthlyStats): Promise<string> {
  const noteAchievement = stats.noteCount >= 12
    ? '週3本ペース達成！'
    : `週平均${(stats.noteCount / 4).toFixed(1)}本`;

  const prompt = `
先月の活動データを分析して、月報LINEメッセージを生成してください。
アスタリスク（*）は絶対に使わないでください。強調は絵文字や「！」で表現してください。

【${stats.monthName}の実績】
・完了タスク数：${stats.completedCount}個
・ノーラ動画：${stats.noraVideos}本
・モナ動画：${stats.monaVideos}本
・note：${stats.noteCount}本（${noteAchievement}）
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日
・重タスク完了：${stats.heavyTaskCount}個

以下のフォーマットで出力してください：

${stats.monthName}の月報 📅

おつかれさまでした ☀️

■ 先月の実績
（実績一覧）

■ AI分析
（先月の総括。3〜5文。頑張りを可視化。反省会にしない。重・中タスクの達成も評価する。アスタリスクなし）

■ 来月の提案
（具体的な提案を2〜3点。箇条書きは「・」を使う）
`.trim();

  return callClaude(prompt);
}
