/**
 * 夜の振り返り通知のテスト実行スクリプト
 * 使い方: npm run test:evening
 */
import 'dotenv/config';
import { runEveningNotification } from './cron/evening';

(async () => {
  console.log('=== 夜の振り返り通知テスト ===');
  await runEveningNotification();
})();
