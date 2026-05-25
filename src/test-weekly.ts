/**
 * 週報通知のテスト実行スクリプト
 * 使い方: npm run test:weekly
 */
import 'dotenv/config';
import { runWeeklyReport } from './cron/weekly';

(async () => {
  console.log('=== 週報通知テスト ===');
  await runWeeklyReport();
})();
