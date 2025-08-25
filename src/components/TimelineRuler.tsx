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
  // Use pure JS rendering for proper tick/label positioning
  React.useEffect(() => {
    const tc = document.getElementById('gantt-timeline-content');
    if (!tc) return;
    
    const contentWidth = parseInt(tc.style.width || '0', 10) || tc.clientWidth;
    
    if (viewConfig.type === 'hour') {
      if (window.renderHourTimeline) {
        window.renderHourTimeline(contentWidth / 24, contentWidth);
      }
    } else if (viewConfig.type === 'month') {
      const daysInMonth = new Date(viewConfig.selectedDate.getFullYear(), viewConfig.selectedDate.getMonth() + 1, 0).getDate();
      if (window.renderMonthTimeline) {
        window.renderMonthTimeline(contentWidth / daysInMonth, daysInMonth, contentWidth);
      }
    } else if (viewConfig.type === 'week') {
      // Keep existing week rendering for now
      const { selectedDate, preset } = viewConfig;
      const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
      const isoMonday = (d: Date) => { const x = startOfDay(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; };
      const anchor = isoMonday(selectedDate);
      const days = /work/i.test(String(preset)) ? 5 : 7;
      
      tc.innerHTML = '';
      
      for (let day = 0; day <= days; day++) {
        const x = Math.round(day * pxPerUnit);
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:#394454;`;
        tc.appendChild(line);
        
        if (day < days) {
          const currentDay = new Date(anchor);
          currentDay.setDate(anchor.getDate() + day);
          const weekdayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          const weekdayIndex = (currentDay.getDay() + 6) % 7;
          const weekdayLabel = `${weekdayNames[weekdayIndex]} ${currentDay.getDate()}.${currentDay.getMonth()+1}.`;
          
          const lab = document.createElement('div');
          lab.className = 'gantt-tick--label';
          lab.textContent = weekdayLabel;
          lab.style.position = 'absolute';
          lab.style.top = '4px';
          lab.style.left = (x + Math.round(pxPerUnit/2)) + 'px';
          lab.style.transform = 'translateX(-50%)';
          tc.appendChild(lab);
        }
      }
    }
  }, [viewConfig, pxPerUnit, totalUnits]);

  return (
    <div className="relative h-12">
      {/* Timeline content is rendered via pure JS */}
    </div>
  );
};

export default TimelineRuler;