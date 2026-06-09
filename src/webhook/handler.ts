import * as crypto from 'crypto';
import { sendLineMessage } from '../line/sender';
import { fetchTodayTasks, addNotionTask, completeNotionTask } from '../notion/client';
import { fetchWorkTypeFromCalendar } from '../google/calendar';

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!;
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

export async function handleLineMessage(
  userId: string,
  text: string
): Promise<void> {
  console.log(`受信メッセージ: "${text}"`);
  const trimmed = text.trim();

  const kanryoMatch = trimmed.match(/^完了[：:]\s*(.+)/);
  if (kanryoMatch) {
    const taskName = kanryoMatch[1].trim();
    try {
      await completeNotionTask(taskName);
      await sendLineMessage(`✅ 「${taskName}」を完了にしました！`);
    } catch {
      await sendLineMessage(`❌ 「${taskName}」が見つかりませんでした。`);
    }
    return;
  }

  const tsuikaMatch = trimmed.match(/^追加[：:]\s*(.+)/);
  if (tsuikaMatch) {
    const taskName = tsuikaMatch[1].trim();
    try {
      await addNotionTask(taskName);
      await sendLineMessage(`📝 「${taskName}」を追加しました！`);
    } catch (err) {
      console.error('追加エラー:', err);
      await sendLineMessage(`❌ タスクの追加に失敗しました。`);
    }
    return;
  }

  if (trimmed === 'タスク') {
    try {
      const [tasks, workType] = await Promise.all([
        fetchTodayTasks(),
        fetchWorkTypeFromCalendar(),
      ]);
      const pending = tasks.filter((t: any) => t.status !== '完了');
      if (pending.length === 0) {
        await sendLineMessage('🎉 今日のタスクはすべて完了しています！');
        return;
      }
      const list = pending
        .map((t: any, i: number) => `${i + 1}. ${t.name}`)
        .join('\n');
      await sendLineMessage(`📋 今日の残りタスク（${workType ?? '未設定'}）\n\n${list}`);
    } catch {
      await sendLineMessage('❌ タスクの取得に失敗しました。');
    }
    return;
  }

  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    await sendLineMessage(
      `🤖 使えるコマンド一覧\n\n` +
      `📋 タスク\n→ 今日の残りタスクを表示\n\n` +
      `✅ 完了: タスク名\n→ タスクを完了にする\n\n` +
      `📝 追加: タスク名\n→ タスクを追加する`
    );
    return;
  }

  console.log(`未認識メッセージ: "${trimmed}"`);
  await sendLineMessage(`「ヘルプ」と送るとコマンド一覧が見られます😊`);
}
