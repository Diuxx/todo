import { Weekday } from '@capacitor/local-notifications';

export interface DailyTaskNotification {
  taskId: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
  weekday?: Weekday;
  dayOfMonth?: number;
  route?: string;
}
