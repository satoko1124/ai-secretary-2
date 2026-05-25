# AI秘書 LINE通知システム

> 「もっと頑張らせる」ためではなく、「壊れず継続する」ためのAI秘書。

病院勤務をしながら創作活動を継続するための、Notion連携型AI秘書システムです。

## 機能

| 機能 | タイミング | 内容 |
|---|---|---|
| 毎朝通知 | 毎日 6:00 JST | 今日のタスク・勤務・AI分析をLINE送信 |
| 週報通知 | 毎週日曜 21:00 JST | 今週の活動まとめ・AI分析をLINE送信 |

---

## 必要なもの

- Node.js 18以上
- Notionアカウント・データベース
- OpenAI APIキー
- LINE Developers アカウント

---

## セットアップ手順

### 1. リポジトリのクローンとインストール

```bash
git clone <your-repo>
cd ai-secretary
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開いて、各値を設定してください（後述）。

---

## Notion API 設定

### 1. インテグレーション作成

1. [Notion Developers](https://www.notion.so/my-integrations) を開く
2. 「新しいインテグレーション」をクリック
3. 名前（例：`AI秘書`）を入力して作成
4. 表示される **Internal Integration Token** をコピー → `NOTION_API_KEY` に設定

### 2. データベースにインテグレーションを接続

1. Notionで「すべて」データベースを開く
2. 右上「...」→「コネクト先」→ 作成したインテグレーションを選択

### 3. データベースIDの取得

データベースURLの以下の部分が DATABASE_ID です：

```
https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                       これが NOTION_DATABASE_ID
```

### 4. Notionデータベースの必須プロパティ

| プロパティ名 | 型 | 備考 |
|---|---|---|
| 名前 | タイトル | タスク名 |
| 日付 | 日付 | 実施日 |
| 状態 | ステータス | 「完了」で除外 |
| 毎日 | チェックボックス | 毎日タスク判定 |
| 重さ | セレクト | 軽 / 中 / 重 |
| 優先度 | セレクト | 任意 |
| 勤務 | セレクト | 通常勤務 / 早番 / 平日当直 / 土日当直 / 当直明け / 休み |

---

## LINE Developers 設定

### 1. チャンネル作成

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. プロバイダーを作成（または選択）
3. 「Messaging API チャンネル」を新規作成
4. チャンネルを作成後、「Messaging API設定」タブを開く

### 2. チャンネルアクセストークン取得

「Messaging API設定」→「チャンネルアクセストークン（長期）」→「発行」

発行されたトークンを `LINE_CHANNEL_ACCESS_TOKEN` に設定。

### 3. ユーザーIDの取得

「チャンネル基本設定」→「あなたのユーザーID」をコピー

`LINE_USER_ID` に設定（`U` から始まる文字列）。

### 4. Webhook設定（不要）

このシステムは Push Message を使うため、Webhook設定は不要です。

---

## Railwayデプロイ手順

### 1. GitHubにプッシュ

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Railwayでプロジェクト作成

1. [Railway](https://railway.app/) にログイン
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択

### 3. 環境変数の設定

Railwayの「Variables」タブで以下を設定：

```
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=xxx
OPENAI_API_KEY=sk-xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_USER_ID=Uxxx
TZ=Asia/Tokyo
```

### 4. ビルド・スタートコマンド確認

Railway が自動検出しますが、手動設定する場合：

- Build Command: `npm run build`
- Start Command: `npm start`

### 5. デプロイ完了

デプロイ後、Railway のログで以下が表示されれば正常起動：

```
🤖 AI秘書システムを起動します...
✅ cronスケジュール設定完了
  - 毎朝通知: 毎日 06:00 JST
  - 週報通知: 毎週日曜 21:00 JST
```

---

## ローカルテスト

### 毎朝通知のテスト

```bash
npm run test:morning
```

### 週報通知のテスト

```bash
npm run test:weekly
```

---

## ディレクトリ構成

```
ai-secretary/
├── src/
│   ├── index.ts          # エントリーポイント（cronスケジュール）
│   ├── types.ts          # 型定義
│   ├── notion/
│   │   └── client.ts     # Notion API取得処理
│   ├── openai/
│   │   └── comment.ts    # OpenAI コメント生成
│   ├── line/
│   │   └── sender.ts     # LINE送信処理
│   ├── cron/
│   │   ├── morning.ts    # 毎朝通知ロジック
│   │   └── weekly.ts     # 週報通知ロジック
│   ├── test-morning.ts   # テスト実行（毎朝）
│   └── test-weekly.ts    # テスト実行（週報）
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 将来の拡張予定

- Googleカレンダー連携
- 疲労スコアの数値化
- AIスケジュール自動再編成
- 夜の振り返り通知
- 月報機能
- 投稿数分析

---

## 注意事項

- OpenAI API は `gpt-4o-mini` を使用しています（コスト最適化）
- LINE Push Message は月1000通まで無料です
- Notion APIのレート制限：1秒あたり3リクエスト（通常運用で問題なし）
