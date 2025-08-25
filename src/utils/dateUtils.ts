export const formatHour = (hour: number): string => {
  return String(hour).padStart(2, '0'); // "00".."23" (no ":00")
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export const getStartOfDay = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getStartOfWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day;
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

export const getEndOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
};

export const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const differenceInHours = (end: Date, start: Date): number => {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
};

export const differenceInDays = (end: Date, start: Date): number => {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};