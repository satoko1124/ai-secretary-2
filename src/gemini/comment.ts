import { NotionTask, WeeklyStats } from '../types';

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;

const BASE_SYSTEM_PROMPT = `
あなたは「AI秘書」です。
病院勤務をしながら創作活動を継続するユーザーをサポートします。

【ユーザー特性】
- 朝型。午前中に高出力で動きすぎる傾向がある
- 昼以降に疲労で失速しやすい
- 病院勤務（日直・当直・早番あり）
- ノーラの動画は毎日運営中
- モナの動画は感情疲労が大きい
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

【重要】X投稿は低負荷・コピペ運用のため、重タスク判定に含めない。
【重要】アファメーションは回復・精神安定タスク。疲労が高い日ほど優先推奨。

【勤務別の重タスク推奨上限】
- 通常勤務：重タスク1個まで
- 早番：夕方に軽〜中タスク可
- 平日当直：重タスク禁止（超高負荷）
- 土日当直：当直前に重タスク1個まで
- 当直明け：回復優先、重タスク非推奨
- 休み：通常通り

【出力スタイル】
- 優秀な秘書として実務的かつ落ち着いたトーン
- 優しいが甘やかしすぎない
- 回復も「予定」として扱う
- 継続性を最優先する発言をする
- LINEで読みやすい改行・絵文字を使う（過剰にしない）
`.trim();

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${BASE_SYSTEM_PROMPT}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini APIエラー: ${err}`);
  }

  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '（コメント生成失敗）';
}

export async function generateMorningComment(
  workType: string | null,
  tasks: NotionTask[]
): Promise<string> {
  const taskList = tasks.map((t) => `・${t.name}（${t.weight ?? '不明'}）`).join('\n');
  const heavyTasks = tasks.filter((t) => t.weight === '重');

  const prompt = `
今日の状況を分析して、毎朝のLINE通知メッセージを生成してください。

【今日の勤務】
${workType ?? '未設定'}

【今日のタスク一覧】
${taskList || 'なし'}

【重タスク数】
${heavyTasks.length}個（${heavyTasks.map((t) => t.name).join('、') || 'なし'}）

以下のフォーマットで出力してください：

おはようございます ☀️

【勤務】
（勤務種類）

【今日の予定】
（タスク一覧）

【重タスク】
（重タスクがあれば記載、なければ「今日は重タスクなし」）

（AI秘書からの一言アドバイス：午前の配分、疲労リスク、今日のポイント。2〜3文で。責めない・実務的に。）
`.trim();

  return callGemini(prompt);
}

export async function generateWeeklyComment(stats: WeeklyStats): Promise<string> {
  const prompt = `
今週の活動データを分析して、週報LINEメッセージを生成してください。

【今週の実績】
・完了タスク数：${stats.completedCount}個
・ノーラ動画：${stats.noraVideos}本
・モナ動画：${stats.monaVideos}本
・note：${stats.noteCount}本
・evolution学習：${Math.round(stats.evolutionMinutes / 60)}時間（推定）
・X投稿：${stats.xPostCount}回
・アファメーション：${stats.affirmationDays}日

【今週の勤務】
・通常勤務：${stats.normalWorkDays}日
・当直：${stats.nightShiftCount}回
・早番：${stats.morningShiftCount}日
・当直明け：${stats.afterNightShiftDays}日

【負荷情報】
・重タスク完了数：${stats.heavyTaskCount}個

以下のフォーマットで出力してください：

【今週の週報】

おつかれさまでした ☀️

■ 完了
（実績一覧）

■ 勤務
（勤務まとめ）

■ AI分析
（今週の負荷バランス・疲労蓄積ポイント・継続状況を2〜4文で。反省会にしない。頑張りを可視化する。）

■ 来週の提案
（具体的な提案を2〜3点。箇条書き。）
`.trim();

  return callGemini(prompt);
}
