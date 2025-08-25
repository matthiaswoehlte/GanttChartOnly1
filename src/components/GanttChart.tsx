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

  // Layout state - will be set by the layout engine
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

  const handleViewTypeChange = (type: ViewType) => {
    let preset: HourPreset | WeekPreset | MonthPreset;
    
    switch (type) {
      case 'hour':
        preset = '24 Hours' as HourPreset;
        break;
      case 'week':
        preset = 'Full Week' as WeekPreset;
        break;
      case 'month':
        preset = 'Full Month' as MonthPreset;
        break;
    }
    
    setViewConfig({
      ...viewConfig,
      type,
      preset
    });
  };

  const renderPresetOptions = () => {
    switch (viewConfig.type) {
      case 'hour':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value as HourPreset})}
          >
            <option value="4 Hours">4 Hours</option>
            <option value="6 Hours">6 Hours</option>
            <option value="12 Hours">12 Hours</option>
            <option value="18 Hours">18 Hours</option>
            <option value="24 Hours">24 Hours</option>
          </select>
        );
      case 'week':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value as WeekPreset})}
          >
            <option value="Work Week">Work Week</option>
            <option value="Full Week">Full Week</option>
          </select>
        );
      case 'month':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value as MonthPreset})}
          >
            <option value="7 Days">7 Days</option>
            <option value="14 Days">14 Days</option>
            <option value="Full Month">Full Month</option>
          </select>
        );
    }
  };

  // ===== RATIO-BASED LAYOUT ENGINE =====
  useEffect(() => {
    // Deterministic width functions
    function ganttUnits(view: string, presetLabel: string, anchorDate: Date) {
      if (view === 'hour') {
        const v = parseInt(String(presetLabel).match(/(\d+)/)?.[1] || '24', 10); // 24|18|12|6|4
        return { totalUnits: 24, visibleUnits: Math.max(1, v) };
      }
      if (view === 'month') {
        const y = anchorDate.getFullYear(), m = anchorDate.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const v = /14/.test(presetLabel) ? 14 : /7/.test(presetLabel) ? 7 : dim; // 7/14/full
        return { totalUnits: dim, visibleUnits: v };
      }
      // Week is non-scrollable here
      return { totalUnits: 1, visibleUnits: 1 };
    }

    // Set content width once (no observer loops)
    function ganttSetContentWidth(px: number) {
      const w = Math.max(0, Math.round(px));               // no nudge, no ceil+2
      const cc = document.getElementById('gantt-chart-content');
      const tc = document.getElementById('gantt-timeline-content');
      if (!cc || !tc) return;
      cc.style.width = w + 'px';
      tc.style.width = w + 'px';
      document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
    }

    function ganttLayout(view: string, presetLabel: string, anchorDate: Date) {
      const scroller = document.getElementById('gantt-chart-scroll');
      const proxyScroll = document.getElementById('gantt-hscroll-proxy');
      if (!scroller) return;
      const viewport = scroller.clientWidth;                  // width of visible area
      const { totalUnits, visibleUnits } = ganttUnits(view, presetLabel, anchorDate);
      const contentPx = viewport * (totalUnits / Math.max(1, visibleUnits));
      ganttSetContentWidth(contentPx);
      
      // Update React state
      setPxPerUnit(contentPx / totalUnits);
      setTotalUnits(totalUnits);
      
      // Handle scrollbar visibility
      const scrollable = visibleUnits < totalUnits;
      scroller.style.overflowX = scrollable ? 'auto' : 'hidden';
      if (proxyScroll) {
        proxyScroll.style.display = scrollable ? 'block' : 'none';
        const proxyInner = document.getElementById('gantt-hscroll-inner');
        if (proxyInner) proxyInner.style.width = Math.round(contentPx) + 'px';
      }
      
      // Call timeline alignment after layout changes
      if (window.__ganttAlignTimeline) {
        window.__ganttAlignTimeline();
      }
    }

    // Set global variables for resize observer
    (window as any).__ganttView = viewConfig.type;
    (window as any).__ganttPreset = viewConfig.preset;
    (window as any).__ganttAnchor = viewConfig.selectedDate;

    // Initial layout
    ganttLayout(viewConfig.type, viewConfig.preset, viewConfig.selectedDate);

    // Resize observer with debounce & lock
    const scroller = document.getElementById('gantt-chart-scroll');
    if (scroller) {
      let rafId = 0;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          ganttLayout((window as any).__ganttView, (window as any).__ganttPreset, (window as any).__ganttAnchor || new Date());
        });
      });
      ro.observe(scroller);
      
      return () => {
        ro.disconnect();
        cancelAnimationFrame(rafId);
      };
    }
  }, [viewConfig]);

  // Align zero and controls
  useEffect(() => {
    // Pin header to table width
    (function pinHeaderToTable(){
      const table  = document.getElementById('gantt-table-left');
      if (!table) return;
      
      function setTableVar(){
        const w = Math.round(table.getBoundingClientRect().width);   // includes border
        document.documentElement.style.setProperty('--gantt-table-w', w + 'px');
      }
      setTableVar();
      new ResizeObserver(setTableVar).observe(table);
      window.addEventListener('resize', setTableVar);
    })();

    // Calibrate timeline alignment
    (function calibrateTimeline(){
      const table     = document.getElementById('gantt-table-left');
      const chartView = document.getElementById('gantt-chart-scroll');
      const tContent  = document.getElementById('gantt-timeline-content');

      function findBarStartX() {
        const candidate =
          document.querySelector('[data-gantt-x0]') ||
          document.querySelector('.gantt-row-track') ||
          document.querySelector('.task-bar');
        return candidate ? candidate.getBoundingClientRect().left : null;
      }

      function measureAndApply() {
        if (!table || !chartView || !tContent) return;

        const dividerX   = Math.round(table.getBoundingClientRect().right); // the visual divider
        const timeline0X = Math.round(tContent.getBoundingClientRect().left); // current timeline zero
        const barStartX  = findBarStartX();

        // Prefer aligning to the bar start; if unknown, align to divider
        const targetX = (barStartX ?? dividerX);

        // Shift timeline so its zero coincides with targetX:
        const delta = targetX - timeline0X; // positive -> move RIGHT, negative -> move LEFT
        document.documentElement.style.setProperty('--gantt-xfix', `${delta}px`);
      }

      // Run now & on layout changes
      measureAndApply();
      new ResizeObserver(measureAndApply).observe(chartView);
      new ResizeObserver(measureAndApply).observe(table);
      window.addEventListener('resize', measureAndApply);

      // Call after every recompute/re-render
      window.__ganttAlignTimeline = measureAndApply;
    })();
  }, []);

  // Scroll sync (loop-safe, attach ONCE)
  useEffect(() => {
    // One-way scroll sync (Bars → Timeline) + Wheel forwarding
    (function wireGanttScrollSync() {
      const a = document.getElementById('gantt-chart-scroll');
      const b = document.getElementById('gantt-timeline-scroll');
      const proxy = document.getElementById('gantt-hscroll-proxy');
      if (!a || !b) return;
      
      // Bars -> Timeline (one-way, no feedback loop)
      a.addEventListener('scroll', () => {
        b.scrollLeft = a.scrollLeft;
        if (proxy) proxy.scrollLeft = a.scrollLeft;
      }, { passive: true });
      
      // Wheel/Trackpad over Timeline controls the Bars scroller
      b.addEventListener('wheel', (e) => {
        // horizontal delta or Shift+Scroll
        if (e.shiftKey || Math.abs(e.deltaX) > 0) {
          const dx = (Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY);
          a.scrollLeft += dx;
          e.preventDefault();
        }
      }, { passive: false });
      
      if (proxy) {
        proxy.addEventListener('scroll', () => {
          a.scrollLeft = proxy.scrollLeft;
          b.scrollLeft = proxy.scrollLeft;
        }, { passive: true });
      }
      
      // Initial alignment (after view/preset switch)
      requestAnimationFrame(() => {
        b.scrollLeft = a.scrollLeft; 
        if (proxy) proxy.scrollLeft = a.scrollLeft; 
      });
    })();
  }, []);

  return (
    <div id="gantt-root">
      {/* Header - Sticky */}
      <div id="gantt-header">
        <div id="gantt-header-grid">
          {/* Left column - bound to table width */}
          <div id="gantt-title">
            <h2 className="text-lg font-semibold text-gray-200">Resources</h2>
          </div>
          
          {/* Right column */}
          <div id="gantt-header-right">
            <div id="gantt-controls" className="mb-3">
              <div className="ctrl">
                <label>View:</label>
                <select
                  value={viewConfig.type}
                  onChange={(e) => handleViewTypeChange(e.target.value as ViewType)}
                >
                  <option value="hour">Hour</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
              
              <div className="ctrl">
                <label>Preset:</label>
                {renderPresetOptions()}
              </div>
              
              <div className="ctrl">
                <label>Month:</label>
                <input
                  id="gantt-month"
                  type="month"
                  value={`${viewConfig.selectedDate.getFullYear()}-${(viewConfig.selectedDate.getMonth() + 1).toString().padStart(2, '0')}`}
                  onChange={handleMonthChange}
                />
              </div>
              
              <div className="ctrl">
                <span id="gantt-date-label">
                  {formatDateLabel(viewConfig.selectedDate)}
                </span>
              </div>
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
          
          {/* Header vertical rule */}
          <div id="gantt-header-vrule" aria-hidden="true" />
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
      <div id="gantt-footer">
        <div id="dbg" className="text-xs text-gray-400 font-mono bg-gray-800 px-4 py-2 border-t border-gray-600">Debug info will appear here</div>
      </div>
    </div>
  );
};

export default GanttChart;