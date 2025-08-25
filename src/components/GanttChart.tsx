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
  const startOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const isoMonday = (d: Date): Date => {
    const x = startOfDay(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    return x;
  };

  const firstOfMonth = (d: Date): Date => {
    const x = startOfDay(d);
    x.setDate(1);
    return x;
  };

  const daysInMonth = (d: Date): number => {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  };

  const viewportW = (): number => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    return chartScroll ? chartScroll.getBoundingClientRect().width : 0;
  };

  const applyW = (px: number) => {
    const w = Math.ceil(px) + 2; // safety to guarantee the last pixel is reachable
    const chartContent = document.getElementById('gantt-chart-content');
    const timelineCont = document.getElementById('gantt-timeline-content');
    const proxyInner = document.getElementById('gantt-hscroll-inner');
    
    if (chartContent) {
      chartContent.style.width = w + 'px';
      chartContent.style.minWidth = w + 'px';
    }
    if (timelineCont) {
      timelineCont.style.width = w + 'px';
      timelineCont.style.minWidth = w + 'px';
    }
    if (proxyInner) {
      proxyInner.style.width = w + 'px';
    }
    document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
  };

  const clampScroll = () => {
    requestAnimationFrame(() => {
      const chartScroll = document.getElementById('gantt-chart-scroll');
      const proxyScroll = document.getElementById('gantt-hscroll-proxy');
      
      if (chartScroll && proxyScroll) {
        const maxC = chartScroll.scrollWidth - chartScroll.clientWidth;
        const maxP = proxyScroll.scrollWidth - proxyScroll.clientWidth;
        chartScroll.scrollLeft = Math.max(0, Math.min(chartScroll.scrollLeft, maxC));
        proxyScroll.scrollLeft = Math.max(0, Math.min(proxyScroll.scrollLeft, maxP));
      }
    });
  };

  // Layout calculators
  const layoutHour = () => {
    const visible = parseInt(viewConfig.preset.replace('h', ''));
    const total = 24;
    const newPxPerUnit = viewportW() / visible;
    
    setPxPerUnit(newPxPerUnit);
    setTotalUnits(total);
    applyW(total * newPxPerUnit);
    
    const chartScroll = document.getElementById('gantt-chart-scroll');
    const proxyScroll = document.getElementById('gantt-hscroll-proxy');
    
    const noScroll = visible === 24;
    if (chartScroll) {
      chartScroll.style.overflowX = noScroll ? 'hidden' : 'auto';
    }
    if (proxyScroll) {
      proxyScroll.style.display = noScroll ? 'none' : 'block';
    }
  };

  const layoutWeek = () => {
    const days = (viewConfig.preset === 'full') ? 7 : 5;
    const newPxPerUnit = viewportW() / days;
    
    setPxPerUnit(newPxPerUnit);
    setTotalUnits(days);
    applyW(days * newPxPerUnit);
    
    const chartScroll = document.getElementById('gantt-chart-scroll');
    const timelineScroll = document.getElementById('gantt-timeline-scroll');
    const proxyScroll = document.getElementById('gantt-hscroll-proxy');
    
    if (chartScroll) {
      chartScroll.style.overflowX = 'hidden';
      chartScroll.scrollLeft = 0;
    }
    if (timelineScroll) {
      timelineScroll.scrollLeft = 0;
    }
    if (proxyScroll) {
      proxyScroll.style.display = 'none';
    }
  };

  const layoutMonth = () => {
    const dim = daysInMonth(firstOfMonth(viewConfig.selectedDate));
    const vis = (viewConfig.preset === 'full' || Number(viewConfig.preset) === dim) ? dim : Number(viewConfig.preset);
    const newPxPerUnit = viewportW() / vis;
    
    setPxPerUnit(newPxPerUnit);
    setTotalUnits(dim);
    applyW(dim * newPxPerUnit);
    
    const chartScroll = document.getElementById('gantt-chart-scroll');
    const proxyScroll = document.getElementById('gantt-hscroll-proxy');
    
    const scrollable = vis < dim;
    if (chartScroll) {
      chartScroll.style.overflowX = scrollable ? 'auto' : 'hidden';
    }
    if (proxyScroll) {
      proxyScroll.style.display = scrollable ? 'block' : 'none';
    }
  };

  // Public entry: recompute everything
  const recomputeLayout = () => {
    if (viewConfig.type === 'hour') layoutHour();
    if (viewConfig.type === 'week') layoutWeek();
    if (viewConfig.type === 'month') layoutMonth();
    clampScroll();
    
    const dbg = document.getElementById('dbg');
    if (dbg) {
      const chartScroll = document.getElementById('gantt-chart-scroll');
      if (chartScroll) {
        const maxScroll = chartScroll.scrollWidth - chartScroll.clientWidth;
        dbg.textContent = `view=${viewConfig.type} preset=${viewConfig.preset} vw=${viewportW().toFixed(2)} px/u=${pxPerUnit.toFixed(4)} content=${chartScroll.scrollWidth}px max=${maxScroll}px`;
      }
    }
  };

  // Scroll synchronization
  useEffect(() => {
    let syncing = false;
    
    const sync = (from: HTMLElement, a: HTMLElement, b: HTMLElement) => {
      if (syncing) return;
      syncing = true;
      a.scrollLeft = from.scrollLeft;
      b.scrollLeft = from.scrollLeft;
      syncing = false;
    };
    
    const proxyScroll = document.getElementById('gantt-hscroll-proxy');
    const chartScroll = document.getElementById('gantt-chart-scroll');
    const timelineScroll = document.getElementById('gantt-timeline-scroll');
    
    if (!proxyScroll || !chartScroll || !timelineScroll) return;
    
    const syncFromProxy = () => sync(proxyScroll, chartScroll, timelineScroll);
    const syncFromChart = () => sync(chartScroll, proxyScroll, timelineScroll);
    const syncFromTimeline = () => sync(timelineScroll, proxyScroll, chartScroll);
    
    proxyScroll.addEventListener('scroll', syncFromProxy, { passive: true });
    chartScroll.addEventListener('scroll', syncFromChart, { passive: true });
    timelineScroll.addEventListener('scroll', syncFromTimeline, { passive: true });
    
    return () => {
      proxyScroll.removeEventListener('scroll', syncFromProxy);
      chartScroll.removeEventListener('scroll', syncFromChart);
      timelineScroll.removeEventListener('scroll', syncFromTimeline);
    };
  }, []);

  // Recompute on view/preset/date changes
  useEffect(() => {
    recomputeLayout();
  }, [viewConfig]);

  // ResizeObserver for container width changes
  useEffect(() => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    if (!chartScroll) return;

    const resizeObserver = new ResizeObserver(() => {
      recomputeLayout();
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
        <div id="dbg" className="text-xs text-gray-400 font-mono"></div>
      </div>
    </div>
  );
};

export default GanttChart;