import { NotionTask, WeeklyStats } from '../types';

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

【AI秘書の行動原則】
- ユーザーを責めない
- 気合い論・精神論を使わない
- オーバーワークを防ぐ
- 回復を予定として組み込む
- 継続可能性を最優先する

【タスク負荷基準】
- 軽：X投稿、アファメーション、SNS確認、ノーラの動画
- 中：note執筆、アメブロ執筆、evolution動画まとめ
- 重：モナの動画編集、evolution動画視聴

【勤務別の重タスク推奨上限】
- 通常勤務：重タスク1個まで
- 早番：夕方に軽〜中タスク可
- 平日当直：重タスク禁止
- 土日当直：当直前に重タスク1個まで
- 当直明け：回復優先、重タスク非推奨
- 休み：通常通り

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
  weeklyNoteCount: number
): Promise<string> {
  const taskList = tasks.map((t) => `・${t.name}（${t.weight ?? '未設定'}）`).join('\n');
  const heavyTasks = tasks.filter((t) => t.weight === '重');

  const noteRemaining = Math.max(0, 3 - weeklyNoteCount);
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dayOfWeek = today.getDay();
  const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const prompt = `
今日の状況を分析して、毎朝のLINE通知メッセージを生成してください。

【今日の勤務】
${workType ?? '未設定'}

【今日のタスク一覧】
${taskList || 'なし'}

【重タスク数】
${heavyTasks.length}個（${heavyTasks.map((t) => t.name).join('、') || 'なし'}）

【note進捗】
今週：${weeklyNoteCount}本 / 目標3本
残り：${noteRemaining}本（今週残り${daysLeft}日）

以下のフォーマットで出力してください：

おはようございます ☀️

【勤務】
（勤務種類）

【今日の予定】
（タスク一覧）

【重タスク】
（重タスクがあれば記載、なければ「今日は重タスクなし」）

📝 note進捗
（今週の本数／目標、残り本数、今日書くべきか一言）

（AI秘書からの一言アドバイス：2〜3文で。責めない・実務的に。）
`.trim();

  return callClaude(prompt);
}

export async function generateWeeklyComment(stats: WeeklyStats): Promise<string> {
  const noteAchievement = stats.noteCount >= 3 ? '✅ 達成！' : `あと${3 - stats.noteCount}本`;

  const prompt = `
今週の活動データを分析して、週報LINEメッセージを生成してください。

【今週の実績】
・完了タスク数：${stats.completedCount}個
・ノーラ動画：${stats.noraVideos}本
・note：${stats.noteCount}本（目標3本 ${noteAchievement}）
・evolution学習：${Math.round(stats.evolutionMinutes / 60)}時間
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日

【今週の勤務】
・通常勤務：${stats.normalWorkDays}日
・当直：${stats.nightShiftCount}回
・早番：${stats.morningShiftCount}日
・当直明け：${stats.afterNightShiftDays}日

以下のフォーマットで出力してください：

【今週の週報】

おつかれさまでした ☀️

■ 完了
（実績一覧）

■ 勤務
（勤務まとめ）

■ AI分析
（2〜4文。反省会にしない。頑張りを可視化する。）

■ 来週の提案
（2〜3点。箇条書き。）
`.trim();

  return callClaude(prompt);
}
