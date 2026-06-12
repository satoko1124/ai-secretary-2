import * as crypto from 'crypto';
import { sendLineMessage } from '../line/sender';
import { fetchTodayTasks, addNotionTask, completeNotionTask } from '../notion/client';
import { fetchWorkTypeFromCalendar } from '../google/calendar';
import { addPeriodRecord, addConditionRecord, addMemoRecord } from '../notion/record';

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!;
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

const COMMAND_LIST = `🤖 使えるコマンド一覧

📋 タスク
→ 今日の残りタスクを表示

✅ 完了: タスク名
→ タスクを完了にする

📝 追加: タスク名
→ タスクを追加する

生理: 1日目
→ 生理日を記録する

体調: 不良
→ 今日を回復する日として記録する

メモ: 内容
→ アイデアや思いつきをメモする

コマンド
→ このコマンド一覧を表示`;

export async function handleLineMessage(
  userId: string,
  text: string
): Promise<void> {
  console.log(`受信メッセージ: "${text}"`);
  const trimmed = text.trim();

  const periodMatch = trimmed.match(/^生理[：:]\s*(\d+)日目/);
  if (periodMatch) {
    const day = parseInt(periodMatch[1]);
    try {
      await addPeriodRecord(day);
      await sendLineMessage(`生理${day}日目を記録しました。無理せず過ごしてね🌸`);
    } catch (err) {
      console.error('生理記録エラー:', err);
      await sendLineMessage(`❌ 記録に失敗しました。`);
    }
    return;
  }

  const conditionMatch = trimmed.match(/^体調[：:]\s*(.+)/);
  if (conditionMatch) {
    const note = conditionMatch[1].trim();
    try {
      await addConditionRecord(note === '不良' ? '' : note);
      await sendLineMessage(`体調不良を記録しました。今日は無理せず過ごしてね🍵`);
    } catch (err) {
      console.error('体調記録エラー:', err);
      await sendLineMessage(`❌ 記録に失敗しました。`);
    }
    return;
  }

  const memoMatch = trimmed.match(/^メモ[：:]\s*(.+)/);
  if (memoMatch) {
    const content = memoMatch[1].trim();
    try {
      await addMemoRecord(content);
      await sendLineMessage(`📝 メモを記録しました：「${content}」`);
    } catch (err) {
      console.error('メモ記録エラー:', err);
      await sendLineMessage(`❌ 記録に失敗しました。`);
    }
    return;
  }

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

  if (trimmed === 'コマンド' || trimmed === 'ヘルプ' || trimmed === 'help') {
    await sendLineMessage(COMMAND_LIST);
    return;
  }

  console.log(`未認識メッセージ: "${trimmed}"`);
  await sendLineMessage(`「コマンド」と送るとコマンド一覧が見られます😊`);
}
