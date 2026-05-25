/**
 * 毎朝通知のテスト実行スクリプト
 * 使い方: npm run test:morning
 */
import 'dotenv/config';
import { runMorningNotification } from './cron/morning';

(async () => {
  console.log('=== 毎朝通知テスト ===');
  await runMorningNotification();
})();
