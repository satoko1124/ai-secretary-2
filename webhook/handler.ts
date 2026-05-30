import * as crypto from 'crypto';
import { sendLineMessage } from '../line/sender';
import { fetchTodayTasks, fetchTodayWorkType } from '../notion/client';
import { addNotionTask, completeNotionTask } from '../notion/client';

// LINE署名検証
export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!;
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// メッセージを解析してコマンドを実行
export async function handleLineMessage(
  userId: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();

  // 「完了: タスク名」でタスクを完了にする
  if (trimmed.startsWith('完了:') || trimmed.startsWith('完了：')) {
    const taskName = trimmed.replace(/^完了[：:]/, '').trim();
    try {
      await completeNotionTask(taskName);
      await sendLineMessage(`✅ 「${taskName}」を完了にしました！`);
    } catch {
      await sendLineMessage(`❌ 「${taskName}」が見つかりませんでした。`);
    }
    return;
  }

  // 「追加: タスク名」でタスクを追加する
  if (trimmed.startsWith('追加:') || trimmed.startsWith('追加：')) {
    const taskName = trimmed.replace(/^追加[：:]/, '').trim();
    try {
      await addNotionTask(taskName);
      await sendLineMessage(`📝 「${taskName}」を追加しました！`);
    } catch {
      await sendLineMessage(`❌ タスクの追加に失敗しました。`);
    }
    return;
  }

  // 「タスク」で今日のタスク一覧を表示
  if (trimmed === 'タスク') {
    try {
      const [tasks, workType] = await Promise.all([
        fetchTodayTasks(),
        fetchTodayWorkType(),
      ]);
      const pending = tasks.filter((t: any) => t.status !== '完了');
      if (pending.length === 0) {
        await sendLineMessage('🎉 今日のタスクはすべて完了しています！');
        return;
      }
      const list = pending
        .map((t: any, i: number) => `${i + 1}. ${t.name}（${t.weight ?? '中'}）`)
        .join('\n');
      await sendLineMessage(`📋 今日の残りタスク（${workType ?? '通常勤務'}）\n\n${list}`);
    } catch {
      await sendLineMessage('❌ タスクの取得に失敗しました。');
    }
    return;
  }

  // 「ヘルプ」でコマンド一覧を表示
  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    await sendLineMessage(
      `🤖 使えるコマンド一覧\n\n` +
      `📋 タスク\n→ 今日の残りタスクを表示\n\n` +
      `✅ 完了: タスク名\n→ タスクを完了にする\n\n` +
      `📝 追加: タスク名\n→ タスクを追加する`
    );
    return;
  }

  // それ以外のメッセージ
  await sendLineMessage(
    `「ヘルプ」と送るとコマンド一覧が見られます😊`
  );
}
