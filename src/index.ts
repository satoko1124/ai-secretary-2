import 'dotenv/config';
import cron from 'node-cron';
import { runMorningNotification } from './cron/morning';
import { runWeeklyReport } from './cron/weekly';

console.log('🤖 AI秘書システムを起動します...');
console.log(`起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

// ===== 毎朝 6:00 JST =====
// cron の TZ を Asia/Tokyo に設定
cron.schedule(
  '0 6 * * *',
  async () => {
    console.log(`\n[${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}] 毎朝通知 実行中...`);
    await runMorningNotification();
  },
  { timezone: 'Asia/Tokyo' }
);

// ===== 毎週日曜 21:00 JST =====
cron.schedule(
  '0 21 * * 0',
  async () => {
    console.log(`\n[${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}] 週報通知 実行中...`);
    await runWeeklyReport();
  },
  { timezone: 'Asia/Tokyo' }
);

console.log('✅ cronスケジュール設定完了');
console.log('  - 毎朝通知: 毎日 06:00 JST');
console.log('  - 週報通知: 毎週日曜 21:00 JST');
console.log('\n待機中... (Ctrl+C で停止)');
