import React, { useState, useRef, useEffect } from 'react';
import { Task, Resource, ViewConfig } from '../types';
import { generateResources, generateTasks } from '../data/sampleData';
import ViewControls from './ViewControls';
import TimelineRuler from './TimelineRuler';
import ResourceTable from './ResourceTable';
import ChartArea from './ChartArea';

const GanttChart: React.FC = () => {
  // Generate sample data
  const [resources] = useState<Resource[]>(() => generateResources(80));
  const [tasks, setTasks] = useState<Task[]>(() => generateTasks(resources));
  
  const [viewConfig, setViewConfig] = useState<ViewConfig>({
    type: 'hour',
    preset: '24h',
    selectedDate: new Date()
  });

  // Layout state
  const [pxPerUnit, setPxPerUnit] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    console.log('Task updated:', updatedTask);
  };

  const handleTaskMove = (taskId: string, newResourceId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, resourceId: newResourceId } : task
      )
    );
    console.log('Task moved:', taskId, 'to resource:', newResourceId);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, 1); // month is 0-indexed
    setViewConfig(prev => ({
      ...prev,
      selectedDate: newDate
    }));
  };

  const formatDateLabel = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // ===== Width/Scroll Logic (Single Source of Truth) =====
  
  // Helper functions
  function firstOfMonth(d: Date): Date { 
    const x = new Date(d); 
    x.setHours(0, 0, 0, 0); 
    x.setDate(1); 
    return x; 
  }
  
  function daysInMonth(d: Date): number { 
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); 
  }
  
  function viewportW(): number { 
    return document.getElementById('gantt-chart-scroll')?.getBoundingClientRect().width || 0; 
  }

  // NEW: robust preset parsing
  function parseNumericPreset(preset: string | number): number | 'FULL' {
    if (typeof preset === 'number') return preset;
    const s = String(preset).trim();                 // e.g. "14 Days", "6 Hours", "24 Hours"
    if (/^full/i.test(s)) return 'FULL';
    const m = s.match(/(\d+)/);                      // extract first number safely
    return m ? Number(m[1]) : NaN;
  }

  function applyContentWidth(px: number) {
    const w = Math.ceil(px) + 2;                     // +2px safety so last unit is reachable
    const chartContent = document.getElementById('gantt-chart-content');
    const timelineCont = document.getElementById('gantt-timeline-content');
    const proxyInner = document.getElementById('gantt-hscroll-inner');
    
    if (chartContent) {
      chartContent.style.width = chartContent.style.minWidth = w + 'px';
    }
    if (timelineCont) {
      timelineCont.style.width = timelineCont.style.minWidth = w + 'px';
    }
    if (proxyInner) {
      proxyInner.style.width = w + 'px';
    }
    document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
  }

  function clampHorizontal() {
    const chart = document.getElementById('gantt-chart-scroll');
    const proxy = document.getElementById('gantt-hscroll-proxy');
    requestAnimationFrame(() => {
      if (chart && proxy) {
        const maxC = chart.scrollWidth - chart.clientWidth;
        const maxP = proxy.scrollWidth - proxy.clientWidth;
        chart.scrollLeft = Math.max(0, Math.min(chart.scrollLeft, maxC));
        proxy.scrollLeft = Math.max(0, Math.min(proxy.scrollLeft, maxP));
      }
    });
  }

  // Replace layout calculation with exact function
  function recomputeLayout(view: string, preset: string, selectedDate: Date) {
    const chart = document.getElementById('gantt-chart-scroll');
    const proxy = document.getElementById('gantt-hscroll-proxy');
    const timeline = document.getElementById('gantt-timeline-scroll');
    const vw = viewportW();                           // FRACTIONAL viewport width
    let newPxPerUnit = 0, totalUnits = 0, visibleUnits = 0;
    const parsed = parseNumericPreset(preset);

    if (view === 'hour') {
      totalUnits = 24;                               // always 24 hours
      visibleUnits = (parsed === 'FULL') ? 24 : (typeof parsed === 'number' ? parsed : 24);
      if (!visibleUnits || Number.isNaN(visibleUnits)) visibleUnits = 24;  // fallback

      newPxPerUnit = vw / visibleUnits;                  // px per hour
      applyContentWidth(totalUnits * newPxPerUnit);

      const noScroll = visibleUnits === 24;
      if (chart) chart.style.overflowX = noScroll ? 'hidden' : 'auto';
      if (proxy) proxy.style.display = noScroll ? 'none' : 'block';
    }

    if (view === 'week') {
      // Preset: "Full Week" or "Work Week" (may arrive as labels)
      const isFull = /full/i.test(String(preset));
      totalUnits = isFull ? 7 : 5;                  // days in span
      visibleUnits = totalUnits;                      // fully visible (NO H-scroll)

      newPxPerUnit = vw / visibleUnits;                  // px per day
      applyContentWidth(totalUnits * newPxPerUnit);

      if (chart) {
        chart.style.overflowX = 'hidden';
        chart.scrollLeft = 0;
      }
      if (proxy) proxy.style.display = 'none';
      if (timeline) timeline.scrollLeft = 0;
    }

    if (view === 'month') {
      const anchor = firstOfMonth(selectedDate);
      const dim = daysInMonth(anchor);             // 28..31
      totalUnits = dim;

      if (parsed === 'FULL' || parsed === dim) {
        visibleUnits = dim;                           // Full Month → NO H-scroll
      } else {
        // preset likely like "7 Days" or "14 Days"
        const n = typeof parsed === 'number' ? parsed : NaN;
        visibleUnits = (!n || Number.isNaN(n)) ? 14 : n;   // fallback to 14 if parsing fails
      }

      newPxPerUnit = vw / visibleUnits;                  // px per day
      applyContentWidth(totalUnits * newPxPerUnit);

      const scrollable = visibleUnits < totalUnits;
      if (chart) chart.style.overflowX = scrollable ? 'auto' : 'hidden';
      if (proxy) proxy.style.display = scrollable ? 'block' : 'none';
    }

    // Update state
    setPxPerUnit(newPxPerUnit);
    setTotalUnits(totalUnits);

    // Clamp and debug
    clampHorizontal();
    const dbg = document.getElementById('dbg');
    if (dbg && chart) {
      const sw = chart.scrollWidth, cw = chart.clientWidth;
      dbg.textContent = `view=${view} • preset=${preset} • parsed=${parsed} • vw=${vw.toFixed(2)} • visible=${visibleUnits} • total=${totalUnits} • content=${sw}px • client=${cw}px • max=${sw - cw}px`;
    }
  }

  // Scroll synchronization
  useEffect(() => {
    const chart = document.getElementById('gantt-chart-scroll');
    const proxy = document.getElementById('gantt-hscroll-proxy');
    const timeline = document.getElementById('gantt-timeline-scroll');
    
    if (!chart || !proxy || !timeline) return;
    
    let syncing = false;
    function sync(from: HTMLElement, a: HTMLElement, b: HTMLElement) { 
      if (syncing) return; 
      syncing = true; 
      a.scrollLeft = from.scrollLeft; 
      b.scrollLeft = from.scrollLeft; 
      syncing = false; 
    }
    
    const syncFromProxy = () => sync(proxy, chart, timeline);
    const syncFromChart = () => sync(chart, proxy, timeline);
    const syncFromTimeline = () => sync(timeline, proxy, chart);
    
    proxy.addEventListener('scroll', syncFromProxy, { passive: true });
    chart.addEventListener('scroll', syncFromChart, { passive: true });
    timeline.addEventListener('scroll', syncFromTimeline, { passive: true });
    
    return () => {
      proxy.removeEventListener('scroll', syncFromProxy);
      chart.removeEventListener('scroll', syncFromChart);
      timeline.removeEventListener('scroll', syncFromTimeline);
    };
  }, []);

  // Call recomputeLayout on view/preset/date changes
  useEffect(() => {
    recomputeLayout(viewConfig.type, viewConfig.preset, viewConfig.selectedDate);
  }, [viewConfig]);

  // ResizeObserver on #gantt-chart-scroll
  useEffect(() => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    if (!chartScroll) return;

    const resizeObserver = new ResizeObserver(() => {
      recomputeLayout(viewConfig.type, viewConfig.preset, viewConfig.selectedDate);
    });

    resizeObserver.observe(chartScroll);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div id="gantt-root">
      {/* Header - Sticky */}
      <div id="gantt-header">
        <div className="grid grid-cols-5 h-auto">
          {/* Left column - 20% */}
          <div className="col-span-1 bg-gray-800 px-4 py-3 border-r border-gray-600">
            <h2 className="text-lg font-semibold text-gray-200">Resources</h2>
          </div>
          
          {/* Right column - 80% */}
          <div className="col-span-4 bg-gray-800 px-4 py-3">
            <div className="flex items-center gap-4 mb-3">
              <ViewControls
                viewConfig={viewConfig}
                onViewConfigChange={setViewConfig}
              />
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-300 font-medium">Month:</label>
                <input
                  id="gantt-month"
                  type="month"
                  value={`${viewConfig.selectedDate.getFullYear()}-${(viewConfig.selectedDate.getMonth() + 1).toString().padStart(2, '0')}`}
                  onChange={handleMonthChange}
                  className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
                />
              </div>
              
              <span id="gantt-date-label" className="text-sm text-gray-300">
                {formatDateLabel(viewConfig.selectedDate)}
              </span>
            </div>
            
            {/* Timeline Ruler */}
            <div id="gantt-timeline-scroll">
              <div id="gantt-timeline-content">
                <TimelineRuler
                  viewConfig={viewConfig}
                  pxPerUnit={pxPerUnit}
                  totalUnits={totalUnits}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body - Scrollable */}
      <div id="gantt-body-scroll">
        <div id="gantt-body-row">
          {/* Left pane - Resources (20%, fixed width, pinned) */}
          <div id="gantt-table-left">
            <ResourceTable resources={resources} />
          </div>

          {/* Right pane - Chart (80%, horizontal scroll only) */}
          <div id="gantt-chart-scroll">
            <div id="gantt-chart-content">
              <ChartArea
                tasks={tasks}
                resources={resources}
                viewConfig={viewConfig}
                onTaskUpdate={handleTaskUpdate}
                onTaskMove={handleTaskMove}
                pxPerUnit={pxPerUnit}
                totalUnits={totalUnits}
              />
            </div>
          </div>
        </div>
        
        {/* Sticky horizontal scrollbar proxy */}
        <div id="gantt-hscroll-proxy">
          <div id="gantt-hscroll-inner"></div>
        </div>
      </div>

      {/* Footer */}
      <div id="gantt-footer" className="bg-gray-800 px-4 py-2 border-t border-gray-600">
        <div id="dbg" className="text-xs text-gray-400 font-mono">Debug info will appear here</div>
      </div>
    </div>
  );
};

export default GanttChart;