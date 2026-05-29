/**
 * 月報通知のテスト実行スクリプト
 * 使い方: npm run test:monthly
 */
import 'dotenv/config';
import { runMonthlyReport } from './cron/monthly';

(async () => {
  console.log('=== 月報通知テスト ===');
  await runMonthlyReport();
})();
