import React from 'react';
import { ViewConfig } from '../types';
import { formatHour, formatDate, getStartOfDay, getStartOfWeek, getStartOfMonth, getDaysInMonth } from '../utils/dateUtils';

interface TimelineRulerProps {
  viewConfig: ViewConfig;
  pxPerUnit: number;
  totalUnits: number;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({
  viewConfig,
  pxPerUnit,
  totalUnits
}) => {
  // Helper functions for consistent anchor calculations
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const firstOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };
  const isoMonday = (d: Date) => { const x = startOfDay(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; };
  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();

  const renderHourView = () => {
    const ticks = [];
    
    // totalIndices = 25 (0..24). Line at x = index * pxPerUnit (hours).
    for (let hour = 0; hour <= 24; hour++) {
      const x = Math.round(hour * pxPerUnit);  // avoid subpixel drift
      
      if (hour < 24) {
        ticks.push(
          <div key={`hour-${hour}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className={`absolute top-1 text-xs text-gray-300 font-medium gantt-tick--${
                hour === 0 ? 'first' : hour === 23 ? 'last' : 'middle'
              }`}
              style={{
                // Labels: 0 align-left; 1..23 centered (translateX(-50%)); 24 align-right (translateX(-100%))
                left: hour === 0 ? '2px' : 'auto',
                right: 'auto',
                transform: hour === 0 ? 'none' : 'translateX(-50%)',
                marginLeft: hour === 0 ? '0' : '-50%'
              }}
            >
              {formatHour(hour)}
            </div>
          </div>
        );
        
        // Minor tick (30 minutes) if there's enough space
        if (pxPerUnit >= 40) {
          const minorX = Math.round(x + pxPerUnit * 0.5);
          ticks.push(
            <div key={`half-${hour}`} className="absolute top-0 h-6 border-l border-gray-700" style={{ left: minorX }} />
          );
        }
      } else {
        // End cap line at x=24*pxPerUnit
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium gantt-tick--last"
              style={{
                left: 'auto',
                right: '2px',
                transform: 'translateX(-100%)'
              }}
            >
              24
            </div>
          </div>
        );
      }
    }
    
    return (
      <div className="relative h-12">
        {ticks}
      </div>
    );
  };

  const renderWeekView = () => {
    const { selectedDate, preset } = viewConfig;
    const anchor = isoMonday(selectedDate);
    const days = /work/i.test(String(preset)) ? 5 : 7;  // default Full=7
    const ticks = [];
    
    // For day index d=0..days: line at x = d * pxPerUnit
    for (let day = 0; day <= days; day++) {
      const x = Math.round(day * pxPerUnit);  // avoid subpixel drift
      
      if (day < days) {
        const currentDay = new Date(anchor);
        currentDay.setDate(anchor.getDate() + day);
        
        // Weekday label with date
        const weekdayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const weekdayIndex = (currentDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        const weekdayLabel = `${weekdayNames[weekdayIndex]} ${currentDay.getDate()}.${currentDay.getMonth()+1}.`;
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className={`absolute top-1 text-xs text-gray-300 font-medium gantt-tick--${
                day === 0 ? 'first' : day === days - 1 ? 'last' : 'middle'
              }`}
              style={{
                // Label for each day cell placed at x = d*pxPerUnit + pxPerUnit/2, centered
                left: day === 0 ? '2px' : `${Math.round(pxPerUnit/2)}px`,
                right: 'auto',
                transform: day === 0 ? 'none' : 'translateX(-50%)'
              }}
            >
              {weekdayLabel}
            </div>
          </div>
        );
      } else {
        // Right edge line at x = days*pxPerUnit
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }} />
        );
      }
    }
    
    return (
      <div className="relative h-12">
        {ticks}
      </div>
    );
  };

  const renderMonthView = () => {
    const { selectedDate } = viewConfig;
    const anchor = firstOfMonth(selectedDate);
    const dim = daysInMonth(selectedDate);
    const ticks = [];
    
    // Lines at x = d*pxPerUnit for d=0..dim
    for (let day = 0; day <= dim; day++) {
      const x = Math.round(day * pxPerUnit);  // avoid subpixel drift
      
      if (day < dim) {
        const currentDay = new Date(anchor);
        currentDay.setDate(anchor.getDate() + day);
        const dayNumber = currentDay.getDate();
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className={`absolute top-1 text-xs text-gray-300 font-medium gantt-tick--${
                day === 0 ? 'first' : day === dim - 1 ? 'last' : 'middle'
              }`}
              style={{
                // Labels for days 1..dim centered in their cells; edges like Hour/Week
                left: day === 0 ? '2px' : 'auto',
                right: day === dim - 1 ? '2px' : 'auto',
                transform: day === 0 || day === dim - 1 ? 'none' : 'translateX(-50%)',
                marginLeft: day === 0 || day === dim - 1 ? '0' : '-50%'
              }}
            >
              {dayNumber}
            </div>
          </div>
        );
      } else {
        // End cap line
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }} />
        );
      }
    }
    
    return (
      <div className="relative h-12">
        {ticks}
      </div>
    );
  };

  return (
    <>
      {viewConfig.type === 'hour' && renderHourView()}
      {viewConfig.type === 'week' && renderWeekView()}
      {viewConfig.type === 'month' && renderMonthView()}
    </>
  );
};

export default TimelineRuler;