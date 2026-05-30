import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const FATIGUE_SCORE: Record<string, number> = {
  通常勤務: 1.0,
  早番: 1.5,
  平日当直: 2.5,
  土日当直: 3.0,
  当直明け: 3.5,
  休み: 0.0,
};

export type TaskWeight = "軽" | "中" | "重";

export interface Task {
  id: string;
  name: string;
  weight: TaskWeight;
  priority?: string;
  status: string;
  isDaily: boolean;
}

export interface OneActionInput {
  tasks: Task[];
  workType: string;
  todayDate: string;
}

export interface OneActionResult {
  taskName: string;
  reason: string;
  fatigueScore: number;
  message: string;
}

export async function selectOneAction(
  input: OneActionInput
): Promise<OneActionResult> {
  const { tasks, workType, todayDate } = input;
  const fatigueScore = FATIGUE_SCORE[workType] ?? 1.0;
  const pendingTasks = tasks.filter((t) => t.status !== "完了");

  if (pendingTasks.length === 0) {
    const message = buildMessage(
      "（タスクなし）",
      "今日は登録タスクがありません。ゆっくり過ごしましょう。",
      fatigueScore,
      workType
    );
    return {
      taskName: "（タスクなし）",
      reason: "今日は登録タスクがありません。ゆっくり過ごしましょう。",
      fatigueScore,
      message,
    };
  }

  const taskList = pendingTasks
    .map(
      (t, i) =>
        `${i + 1}. 「${t.name}」（重さ: ${t.weight}、毎日タスク: ${t.isDaily ? "はい" : "いいえ"}、優先度: ${t.priority ?? "なし"}）`
    )
    .join("\n");

  const fatigueLabel =
    fatigueScore >= 3.0
      ? "非常に疲労しています（当直明けや土日当直後）"
      : fatigueScore >= 2.0
        ? "やや疲労しています（平日当直など）"
        : fatigueScore >= 1.5
          ? "少し疲れています（早番など）"
          : fatigueScore === 0.0
            ? "休日です（体を休める日）"
            : "通常の体調です";

  const prompt = `あなたは病院勤務をしながら創作活動を続ける人を支援するAI秘書です。
「壊れず継続する」ことを最優先に、今日のワンアクションを1つだけ選んでください。

【今日の日付】${todayDate}
【勤務種別】${workType}
【疲労状態】${fatigueLabel}（疲労スコア: ${fatigueScore}）

【未完了タスク一覧】
${taskList}

【選択ルール】
- 疲労スコアが2.5以上の場合は「軽」タスクのみから選ぶこと
- 疲労スコアが1.5〜2.4の場合は「軽」または「中」から選ぶこと
- 疲労スコアが0.0（休日）の場合は無理せず「軽」タスクを推奨すること
- 毎日タスクは優先的に選ぶこと
- 優先度が設定されているものを優先すること
- 「これだけやれば今日は十分」と思えるものを1つ選ぶこと

以下のJSON形式のみで回答してください（他の文章は不要）:
{
  "taskName": "選んだタスク名",
  "reason": "選んだ理由（50字以内、やさしい口調で）"
}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  let taskName = pendingTasks[0].name;
  let reason = "今日はこれだけやれば十分です。";

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      taskName = parsed.taskName ?? taskName;
      reason = parsed.reason ?? reason;
    }
  } catch {
    // パース失敗時はデフォルト値を使用
  }

  const message = buildMessage(taskName, reason, fatigueScore, workType);
  return { taskName, reason, fatigueScore, message };
}

function buildMessage(
  taskName: string,
  reason: string,
  fatigueScore: number,
  workType: string
): string {
  const fatigueEmoji =
    fatigueScore >= 3.0
      ? "🫥"
      : fatigueScore >= 2.0
        ? "😴"
        : fatigueScore >= 1.5
          ? "😐"
          : fatigueScore === 0.0
            ? "🌿"
            : "✨";

  const header =
    fatigueScore >= 3.0
      ? "今日はゆっくりでOKです。"
      : fatigueScore === 0.0
        ? "お休みの日ですね。"
        : "今日もお疲れ様です。";

  return `${fatigueEmoji} 今日のワンアクション

${header}
${workType}の今日は、これだけやれば十分です👇

📌 ${taskName}

💬 ${reason}`;
}
