import React from 'react';
import { ViewConfig } from '../types';
import { formatHour, formatDate } from '../utils/dateUtils';
import { getDaysInMonth, getStartOfDay, getStartOfWeek, getStartOfMonth } from '../utils/dateUtils';

interface TimelineRulerProps {
  viewConfig: ViewConfig;
  containerWidth: number;
  onScroll: (scrollLeft: number) => void;
  scrollLeft: number;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({
  viewConfig
}) => {
  const renderHourView = () => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    if (!chartScroll) return null;
    
    const visible = parseInt(viewConfig.preset.replace('h', ''));
    const viewportW = chartScroll.getBoundingClientRect().width;
    const pxPerHour = viewportW / visible;
    const ticks = [];
    
    // Render major ticks at x = h * pxPerHour for h = 0..24
    for (let hour = 0; hour <= 24; hour++) {
      const x = hour * pxPerHour;
      
      if (hour < 24) {
        // Major tick (hour)
        ticks.push(
          <div key={`hour-${hour}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                left: hour === 0 ? '2px' : (hour === 23 ? 'auto' : '50%'),
                right: hour === 23 ? '2px' : 'auto',
                transform: hour === 0 || hour === 23 ? 'none' : 'translateX(-50%)'
              }}
            >
              {formatHour(hour)}
            </div>
          </div>
        );
        
        // Minor tick (30 minutes)
        if (pxPerHour >= 40) { // Only show minor ticks if there's enough space
          const minorX = x + pxPerHour * 0.5;
          ticks.push(
            <div key={`half-${hour}`} className="absolute top-0 h-6 border-l border-gray-700" style={{ left: minorX }} />
          );
        }
      } else {
        // End cap line at x = 24 * pxPerHour
        ticks.push(
          <div key="end-cap" className="absolute top-0 h-full border-l border-gray-500" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                right: '2px',
                transform: 'translateX(-100%)'
              }}
            >
              24:00
            </div>
          </div>
        );
      }
    }
    
    return (
      <div className="relative h-12" style={{ width: Math.ceil(24 * pxPerHour) + 2 }}>
        {ticks}
      </div>
    );
  };

  const renderWeekView = () => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    if (!chartScroll) return null;
    
    const { selectedDate, preset } = viewConfig;
    const startTime = getStartOfWeek(selectedDate);
    const days = (preset === 'full') ? 7 : 5;
    const viewportW = chartScroll.getBoundingClientRect().width;
    const pxPerDay = viewportW / days;
    const ticks = [];
    
    for (let day = 0; day <= days; day++) {
      const x = day * pxPerDay;
      
      if (day < days) {
        const currentDay = new Date(startTime);
        currentDay.setDate(startTime.getDate() + day);
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                left: day === 0 ? '2px' : (day === days - 1 ? 'auto' : '50%'),
                right: day === days - 1 ? '2px' : 'auto',
                transform: day === 0 || day === days - 1 ? 'none' : 'translateX(-50%)'
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
      <div className="relative h-12" style={{ width: Math.ceil(days * pxPerDay) + 2 }}>
        {ticks}
      </div>
    );
  };

  const renderMonthView = () => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    if (!chartScroll) return null;
    
    const { selectedDate, preset } = viewConfig;
    const startTime = getStartOfMonth(selectedDate);
    const dim = getDaysInMonth(selectedDate);
    const visible = (preset === 'full') ? dim : Number(preset);
    const viewportW = chartScroll.getBoundingClientRect().width;
    const pxPerDay = viewportW / visible;
    const ticks = [];
    
    for (let day = 0; day <= dim; day++) {
      const x = day * pxPerDay;
      
      if (day < dim) {
        const currentDay = new Date(startTime);
        currentDay.setDate(startTime.getDate() + day);
        
        ticks.push(
          <div key={`day-${day}`} className="absolute top-0 h-full border-l border-gray-600" style={{ left: x }}>
            <div 
              className="absolute top-1 text-xs text-gray-300 font-medium"
              style={{
                left: day === 0 ? '2px' : (day === dim - 1 ? 'auto' : '50%'),
                right: day === dim - 1 ? '2px' : 'auto',
                transform: day === 0 || day === dim - 1 ? 'none' : 'translateX(-50%)'
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
      <div className="relative h-12" style={{ width: Math.ceil(dim * pxPerDay) + 2 }}>
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