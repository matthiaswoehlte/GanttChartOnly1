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

export type HourPreset = '24 Hours' | '18 Hours' | '12 Hours' | '6 Hours' | '4 Hours';
export type WeekPreset = 'Full Week' | 'Work Week';
export type MonthPreset = '7 Days' | '14 Days' | 'Full Month';

export interface ViewConfig {
  type: ViewType;
  preset: HourPreset | WeekPreset | MonthPreset;
  selectedDate: Date;
}