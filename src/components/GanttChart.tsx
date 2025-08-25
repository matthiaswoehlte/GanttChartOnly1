import React, { useState, useRef, useEffect } from 'react';
import { Task, Resource, ViewConfig } from '../types';
import { generateResources, generateTasks } from '../data/sampleData';
import ViewControls from './ViewControls';
import TimelineRuler from './TimelineRuler';
import ResourceTable from './ResourceTable';
import ChartArea from './ChartArea';
import { getDaysInMonth, getStartOfDay, getStartOfWeek, getStartOfMonth } from '../utils/dateUtils';

const GanttChart: React.FC = () => {
  // Generate sample data
  const [resources] = useState<Resource[]>(() => generateResources(80));
  const [tasks, setTasks] = useState<Task[]>(() => generateTasks(resources));
  
  const [viewConfig, setViewConfig] = useState<ViewConfig>({
    type: 'hour',
    preset: '24h',
    selectedDate: new Date()
  });
  
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (chartScrollRef.current) {
        setContainerWidth(chartScrollRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

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

  const handleScroll = (newScrollLeft: number) => {
    setScrollLeft(newScrollLeft);
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

  // Width calculation and scroll synchronization
  const updateContentWidths = () => {
    const chartScroll = document.getElementById('gantt-chart-scroll');
    const chartContent = document.getElementById('gantt-chart-content');
    const timelineScroll = document.getElementById('gantt-timeline-scroll');
    const timelineCont = document.getElementById('gantt-timeline-content');
    const proxyScroll = document.getElementById('gantt-hscroll-proxy');
    const proxyInner = document.getElementById('gantt-hscroll-inner');
    
    if (!chartScroll || !chartContent || !timelineScroll || !timelineCont || !proxyScroll || !proxyInner) return;
    
    function viewportW() {
      return chartScroll.getBoundingClientRect().width;
    }
    
    function applyW(px: number) {
      const w = Math.ceil(px) + 2;
      chartContent.style.width = w + 'px';
      chartContent.style.minWidth = w + 'px';
      timelineCont.style.width = w + 'px';
      timelineCont.style.minWidth = w + 'px';
      proxyInner.style.width = w + 'px';
      document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
    }
    
    if (viewConfig.type === 'hour') {
      const visible = parseInt(viewConfig.preset.replace('h', ''));
      const pxPerHour = viewportW() / visible;
      const contentW = 24 * pxPerHour;
      applyW(contentW);
      chartScroll.style.overflowX = (visible === 24) ? 'hidden' : 'auto';
      proxyScroll.style.display = (visible === 24) ? 'none' : 'block';
    } else if (viewConfig.type === 'week') {
      const days = (viewConfig.preset === 'full') ? 7 : 5;
      const pxPerDay = viewportW() / days;
      const contentW = days * pxPerDay;
      applyW(contentW);
      chartScroll.style.overflowX = 'hidden';
      proxyScroll.style.display = 'none';
      chartScroll.scrollLeft = 0;
      timelineScroll.scrollLeft = 0;
    } else if (viewConfig.type === 'month') {
      const dim = getDaysInMonth(viewConfig.selectedDate);
      const visible = (viewConfig.preset === 'full') ? dim : Number(viewConfig.preset);
      const pxPerDay = viewportW() / visible;
      const contentW = dim * pxPerDay;
      applyW(contentW);
      chartScroll.style.overflowX = (visible < dim) ? 'auto' : 'hidden';
      proxyScroll.style.display = (visible < dim) ? 'block' : 'none';
    }
    
    requestAnimationFrame(() => {
      const maxChart = chartScroll.scrollWidth - chartScroll.clientWidth;
      const maxProxy = proxyScroll.scrollWidth - proxyScroll.clientWidth;
      chartScroll.scrollLeft = Math.max(0, Math.min(chartScroll.scrollLeft, maxChart));
      proxyScroll.scrollLeft = Math.max(0, Math.min(proxyScroll.scrollLeft, maxProxy));
    });
    
    // Update debug info
    const dbg = document.getElementById('dbg');
    if (dbg) {
      if (viewConfig.type === 'hour') {
        const visible = parseInt(viewConfig.preset.replace('h', ''));
        const viewportWidth = viewportW();
        dbg.textContent = `Hour preset=${viewConfig.preset} • vw=${viewportWidth.toFixed(2)} • contentW=${chartScroll.scrollWidth}px • clientW=${chartScroll.clientWidth}px • max=${chartScroll.scrollWidth - chartScroll.clientWidth}px`;
      } else {
        const maxScroll = chartScroll.scrollWidth - chartScroll.clientWidth;
        dbg.textContent = `view=${viewConfig.type} • preset=${viewConfig.preset} • vw=${viewportW().toFixed(1)}px • contentW=${chartScroll.scrollWidth}px • maxScroll=${maxScroll}px`;
      }
    }
  };

  // Sync scrolling between timeline, chart, and proxy
  useEffect(() => {
    let syncing = false;
    
    const timelineScroller = timelineScrollRef.current;
    const chartScroller = chartScrollRef.current;
    const proxyScroller = document.getElementById('gantt-hscroll-proxy');
    
    if (!timelineScroller || !chartScroller || !proxyScroller) return;
    
    function sync(from: HTMLElement, a: HTMLElement, b: HTMLElement) {
      if (syncing) return;
      syncing = true;
      a.scrollLeft = from.scrollLeft;
      b.scrollLeft = from.scrollLeft;
      setScrollLeft(from.scrollLeft);
      syncing = false;
    }
    
    const syncFromProxy = () => sync(proxyScroller, chartScroller, timelineScroller);
    const syncFromChart = () => sync(chartScroller, proxyScroller, timelineScroller);
    const syncFromTimeline = () => sync(timelineScroller, proxyScroller, chartScroller);
    
    proxyScroller.addEventListener('scroll', syncFromProxy, { passive: true });
    chartScroller.addEventListener('scroll', syncFromChart, { passive: true });
    timelineScroller.addEventListener('scroll', syncFromTimeline, { passive: true });
    
    return () => {
      proxyScroller.removeEventListener('scroll', syncFromProxy);
      chartScroller.removeEventListener('scroll', syncFromChart);
      timelineScroller.removeEventListener('scroll', syncFromTimeline);
    };
  }, []);

  // Update content widths when view config changes or container resizes
  useEffect(() => {
    updateContentWidths();
  }, [viewConfig, containerWidth]);

  // ResizeObserver for container width changes
  useEffect(() => {
    const chartScroller = chartScrollRef.current;
    if (!chartScroller) return;

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = chartScroller.getBoundingClientRect().width;
      if (Math.abs(newWidth - containerWidth) > 1) {
        setContainerWidth(newWidth);
      }
    });

    resizeObserver.observe(chartScroller);
    return () => resizeObserver.disconnect();
  }, [containerWidth]);

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
            <div id="gantt-timeline-scroll" ref={timelineScrollRef}>
              <div id="gantt-timeline-content">
                <TimelineRuler
                  viewConfig={viewConfig}
                  containerWidth={containerWidth}
                  onScroll={handleScroll}
                  scrollLeft={scrollLeft}
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
          <div id="gantt-chart-scroll" ref={chartScrollRef}>
            <div id="gantt-chart-content">
              <ChartArea
                tasks={tasks}
                resources={resources}
                viewConfig={viewConfig}
                containerWidth={containerWidth}
                onScroll={handleScroll}
                scrollLeft={scrollLeft}
                onTaskUpdate={handleTaskUpdate}
                onTaskMove={handleTaskMove}
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