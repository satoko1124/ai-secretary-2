import * as nodeCron from 'node-cron';
import { runMorningNotification } from './morning';
import { runEveningNotification } from './evening';
import { runWeeklyNotification } from './weekly';
import { runMonthlyNotification } from './monthly';

console.log('🤖 AI秘書スケジューラーを起動します...');

// 毎朝6:00 朝の通知
nodeCron.schedule('0 6 * * *', async () => {
  console.log('🌅 毎朝通知を実行します...');
  try {
    await runMorningNotification();
  } catch (err) {
    console.error('毎朝通知エラー:', err);
  }
}, { timezone: 'Asia/Tokyo' });

// 毎晩21:00 夜の振り返り通知
nodeCron.schedule('0 21 * * *', async () => {
  console.log('🌙 夜の振り返り通知を実行します...');
  try {
    await runEveningNotification();
  } catch (err) {
    console.error('夜の振り返り通知エラー:', err);
  }
}, { timezone: 'Asia/Tokyo' });

// 毎週日曜21:00 週報
nodeCron.schedule('0 21 * * 0', async () => {
  console.log('📊 週報通知を実行します...');
  try {
    await runWeeklyNotification();
  } catch (err) {
    console.error('週報通知エラー:', err);
  }
}, { timezone: 'Asia/Tokyo' });

// 毎月1日9:00 月報
nodeCron.schedule('0 9 1 * *', async () => {
  console.log('📅 月報通知を実行します...');
  try {
    await runMonthlyNotification();
  } catch (err) {
    console.error('月報通知エラー:', err);
  }
}, { timezone: 'Asia/Tokyo' });

console.log('✅ スケジューラーが起動しました');
console.log('  - 毎朝6:00 朝の通知');
console.log('  - 毎晩21:00 夜の振り返り');
console.log('  - 毎週日曜21:00 週報');
console.log('  - 毎月1日9:00 月報');
