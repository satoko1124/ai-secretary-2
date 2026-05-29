// Notionから取得するタスクの型
export interface NotionTask {
  id: string;
  name: string;
  date: string | null;
  status: string;
  isDaily: boolean;
  weight: string | null;
  priority: string | null;
  workType: string | null;
}

// 勤務種類
export type WorkType =
  | '通常勤務'
  | '早番'
  | '平日当直'
  | '土日当直'
  | '当直明け'
  | '休み'
  | null;

// タスク負荷レベル
export type TaskWeight = '軽' | '中' | '重' | null;

// 今日の分析結果
export interface DailyAnalysis {
  workType: WorkType;
  tasks: NotionTask[];
  heavyTaskCount: number;
  hasFatiguRisk: boolean;
  dailyTasks: NotionTask[];
  regularTasks: NotionTask[];
}

// 週報用の集計データ
export interface WeeklyStats {
  completedCount: number;
  noraVideos: number;
  monaVideos: number;
  noteCount: number;
  evolutionMinutes: number;
  xPostCount: number;
  affirmationDays: number;
  normalWorkDays: number;
  nightShiftCount: number;
  morningShiftCount: number;
  afterNightShiftDays: number;
  heavyTaskCount: number;
  workTypes: string[];
  taskNames: string[];
}

// 月報用の集計データ
export interface MonthlyStats {
  monthName: string;
  completedCount: number;
  noraVideos: number;
  monaVideos: number;
  noteCount: number;
  xPostCount: number;
  affirmationDays: number;
  normalWorkDays: number;
  nightShiftCount: number;
  morningShiftCount: number;
  afterNightShiftDays: number;
  heavyTaskCount: number;
}
