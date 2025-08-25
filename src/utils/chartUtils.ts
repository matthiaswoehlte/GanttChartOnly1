import { ViewConfig, HourPreset, WeekPreset, MonthPreset } from '../types';
import { getStartOfDay, getStartOfWeek, getStartOfMonth, getDaysInMonth } from './dateUtils';

export const getTimelineConfig = (viewConfig: ViewConfig, containerWidth: number) => {
  const { type, preset, selectedDate } = viewConfig;
  
  switch (type) {
    case 'hour': {
      const hourPreset = preset as HourPreset;
      const visibleHours = parseInt(hourPreset.replace('h', ''));
      const pxPerHour = containerWidth / visibleHours;
      const contentWidth = 24 * pxPerHour; // ALWAYS 24 hours total
      const startTime = getStartOfDay(selectedDate);
      
      return {
        startTime,
        endTime: new Date(startTime.getTime() + 24 * 60 * 60 * 1000),
        pxPerHour,
        pxPerDay: pxPerHour * 24,
        contentWidth,
        visibleHours,
        totalHours: 24,
        unit: 'hour' as const
      };
    }
    
    case 'week': {
      const weekPreset = preset as WeekPreset;
      const visibleDays = weekPreset === 'full' ? 7 : 5;
      const startTime = getStartOfWeek(selectedDate);
      const pxPerDay = containerWidth / visibleDays;
      const contentWidth = containerWidth; // NO horizontal scroll in week
      
      return {
        startTime,
        endTime: new Date(startTime.getTime() + visibleDays * 24 * 60 * 60 * 1000),
        pxPerDay,
        pxPerHour: pxPerDay / 24,
        contentWidth,
        visibleDays,
        totalDays: visibleDays,
        unit: 'day' as const
      };
    }
    
    case 'month': {
      const monthPreset = preset as MonthPreset;
      const startTime = getStartOfMonth(selectedDate);
      const totalDays = getDaysInMonth(selectedDate);
      const visibleDays = monthPreset === 'full' ? totalDays : parseInt(monthPreset);
      const pxPerDay = containerWidth / visibleDays;
      const contentWidth = totalDays * pxPerDay; // Shows H scrollbar if visibleDays < totalDays
      
      return {
        startTime,
        endTime: new Date(startTime.getTime() + totalDays * 24 * 60 * 60 * 1000),
        pxPerDay,
        pxPerHour: pxPerDay / 24,
        contentWidth,
        visibleDays,
        totalDays,
        unit: 'day' as const
      };
    }
  }
};

export const snapToIncrement = (position: number, increment: number): number => {
  return Math.round(position / increment) * increment;
};

export const getSnapIncrement = (viewConfig: ViewConfig, pxPerHour: number): number => {
  switch (viewConfig.type) {
    case 'hour':
      return pxPerHour * 0.5; // 30 minutes
    case 'week':
    case 'month':
      return pxPerHour; // 1 hour for high-resolution dragging
    default:
      return pxPerHour;
  }
};

export const snapToMinutes = (dateMs: number, snapMinutes: number = 5): number => {
  return Math.round(dateMs / (snapMinutes * 60 * 1000)) * (snapMinutes * 60 * 1000);
};