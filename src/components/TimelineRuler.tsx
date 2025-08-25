import React from 'react';
import { ViewConfig } from '../types';
import { formatHour, formatDate } from '../utils/dateUtils';
import { getDaysInMonth, getStartOfDay, getStartOfWeek, getStartOfMonth } from '../utils/dateUtils';

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
  const renderHourView = () => {
    const ticks = [];
    
    // Render major ticks at x = h * pxPerUnit for h = 0..24
    for (let hour = 0; hour <= 24; hour++) {
      const x = hour * pxPerUnit;
      
      if (hour < 24) {
        // Major tick (hour)
        ticks.push(
          <div key={`hour-${hour}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
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
          const minorX = x + pxPerUnit * 0.5;
          ticks.push(
            <div key={`half-${hour}`} className="absolute top-0 h-6 border-l border-gray-700" style={{ left: minorX }} />
          );
        }
      } else {
        // End cap line at x = 24 * pxPerUnit with 24:00 label
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                right: '2px',
                transform: 'translateX(100%)'
              }}
            >
              24:00
            </div>
          </div>
        );
      }
    }
    
    return (
      <div className="relative h-12" style={{ width: Math.ceil(24 * pxPerUnit) + 2 }}>
        {ticks}
      </div>
    );
  };

  const renderWeekView = () => {
    const { selectedDate, preset } = viewConfig;
    const startTime = getStartOfWeek(selectedDate);
    const days = (preset === 'full') ? 7 : 5;
    const ticks = [];
    
    for (let day = 0; day <= days; day++) {
      const x = day * pxPerUnit;
      
      if (day < days) {
        const currentDay = new Date(startTime);
        currentDay.setDate(startTime.getDate() + day);
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                left: day === 0 ? '2px' : 'auto',
                right: 'auto',
                transform: day === 0 ? 'none' : 'translateX(-50%)',
                marginLeft: day === 0 ? '0' : '-50%'
              }}
            >
              {formatDate(currentDay)}
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
      <div className="relative h-12" style={{ width: Math.ceil(days * pxPerUnit) + 2 }}>
        {ticks}
      </div>
    );
  };

  const renderMonthView = () => {
    const { selectedDate } = viewConfig;
    const startTime = getStartOfMonth(selectedDate);
    const dim = getDaysInMonth(selectedDate);
    const ticks = [];
    
    for (let day = 0; day <= dim; day++) {
      const x = day * pxPerUnit;
      
      if (day < dim) {
        const currentDay = new Date(startTime);
        currentDay.setDate(startTime.getDate() + day);
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                left: day === 0 ? '2px' : 'auto',
                right: day === dim - 1 ? '2px' : 'auto',
                transform: day === 0 || day === dim - 1 ? 'none' : 'translateX(-50%)',
                marginLeft: day === 0 || day === dim - 1 ? '0' : '-50%'
              }}
            >
              {currentDay.getDate()}
            </div>
          </div>
        );
      } else {
        // End cap line at last day
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }} />
        );
      }
    }
    
    return (
      <div className="relative h-12" style={{ width: Math.ceil(dim * pxPerUnit) + 2 }}>
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