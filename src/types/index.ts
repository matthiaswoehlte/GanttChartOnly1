export interface Task {
  id: string;
  resourceId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  color: string;
}

export interface Resource {
  id: string;
  name: string;
}

export type ViewType = 'hour' | 'week' | 'month';

export type HourPreset = '24h' | '18h' | '12h' | '6h' | '4h';
export type WeekPreset = 'full' | 'work';
export type MonthPreset = '7' | '14' | 'full';

export interface ViewConfig {
  type: ViewType;
  preset: HourPreset | WeekPreset | MonthPreset;
  selectedDate: Date;
}