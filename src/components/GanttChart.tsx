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

  const renderPresetOptions = () => {
    return (
      <select
        value={viewConfig.preset}
        onChange={(e) => setViewConfig(prev => ({ ...prev, preset: e.target.value }))}
      >
        <option value="24h">24h</option>
        <option value="18h">18h</option>
        <option value="12h">12h</option>
        <option value="6h">6h</option>
        <option value="4h">4h</option>
      </select>
    );
  };

  // ===== RATIO-BASED LAYOUT ENGINE =====
  useEffect(() => {
    // Elements
    const chartScroll    = document.getElementById('gantt-chart-scroll');
    const chartContent   = document.getElementById('gantt-chart-content');
    const timelineScroll = document.getElementById('gantt-timeline-scroll');
    const timelineCont   = document.getElementById('gantt-timeline-content');
    const proxyScroll    = document.getElementById('gantt-hscroll-proxy');
    const proxyInner     = document.getElementById('gantt-hscroll-inner');
    const dbg            = document.getElementById('dbg');

    if (!chartScroll || !chartContent || !timelineScroll || !timelineCont || !proxyScroll || !proxyInner) {
      return;
    }

    // Read from UI state
    let view = viewConfig.type;
    let preset = viewConfig.preset;
    let selDate = viewConfig.selectedDate;

    // Helpers
    const MS_H = 3600000, MS_D = 86400000;
    function startOfDay(d: Date){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
    function firstOfMonth(d: Date){ const x=startOfDay(d); x.setDate(1); return x; }
    function isoMonday(d: Date){ const x=startOfDay(d); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; }
    function daysInMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
    function vw(){ return chartScroll.getBoundingClientRect().width; }
    function parseNum(v: any){ if (typeof v==='number') return v; const m=String(v).match(/(\d+)/); return m?Number(m[1]):NaN; }
    function isFull(v: any){ return /full/i.test(String(v)); }

    function applyW(px: number){
      const w = Math.ceil(px) + 1;   // minimal safety
      chartContent.style.width = chartContent.style.minWidth = w + 'px';
      timelineCont.style.width = timelineCont.style.minWidth = w + 'px';
      proxyInner.style.width   = w + 'px';
      document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
    }
    function clampH(){
      requestAnimationFrame(()=>{
        const maxC = chartScroll.scrollWidth - chartScroll.clientWidth;
        const maxP = proxyScroll.scrollWidth - proxyScroll.clientWidth;
        chartScroll.scrollLeft = Math.max(0, Math.min(chartScroll.scrollLeft, maxC));
        proxyScroll.scrollLeft = Math.max(0, Math.min(proxyScroll.scrollLeft, maxP));
      });
    }

    // The key: ratio-based width
    // contentWidth = viewportWidth * (totalUnits / visibleUnits)
    // pxPerUnit    = contentWidth / totalUnits
    let currentPxPerUnit = 0, currentTotalUnits = 0, visibleUnits = 0;

    function layoutHour(){
      const total = 24;
      const v = parseNum(preset);                 // 24|18|12|6|4, else NaN
      visibleUnits = (!v || Number.isNaN(v)) ? 24 : v;
      currentTotalUnits = total;
      const cw = vw() * (currentTotalUnits / visibleUnits);
      applyW(cw);
      currentPxPerUnit = cw / currentTotalUnits;

      const noScroll = visibleUnits === 24;
      chartScroll.style.overflowX = noScroll ? 'hidden' : 'auto';
      proxyScroll.style.display   = noScroll ? 'none'   : 'block';
    }

    function layoutWeek(){
      const days = /work/i.test(String(preset)) ? 5 : 7;  // default Full=7
      currentTotalUnits = days; visibleUnits = days;
      const cw = vw();                                    // no horizontal scroll
      applyW(cw);
      currentPxPerUnit = cw / currentTotalUnits;
      chartScroll.style.overflowX = 'hidden';
      proxyScroll.style.display   = 'none';
      chartScroll.scrollLeft = 0; timelineScroll.scrollLeft = 0;
    }

    function layoutMonth(){
      const dim = daysInMonth(firstOfMonth(selDate));     // 28..31
      currentTotalUnits = dim;
      if (isFull(preset)) visibleUnits = dim;
      else {
        const v = parseNum(preset);                       // 7|14|dim
        visibleUnits = (!v || Number.isNaN(v)) ? 14 : v;
        if (visibleUnits > dim) visibleUnits = dim;
      }
      const cw = vw() * (currentTotalUnits / visibleUnits);      // ratio → guarantees full span
      applyW(cw);
      currentPxPerUnit = cw / currentTotalUnits;
      const scrollable = visibleUnits < currentTotalUnits;
      chartScroll.style.overflowX = scrollable ? 'auto' : 'hidden';
      proxyScroll.style.display   = scrollable ? 'block' : 'none';
    }

    function recomputeLayout(){
      if (view === 'hour')  layoutHour();
      if (view === 'week')  layoutWeek();
      if (view === 'month') layoutMonth();
      clampH();
      
      // Update React state
      setPxPerUnit(currentPxPerUnit);
      setTotalUnits(currentTotalUnits);
      
      if (dbg){
        const sw=chartScroll.scrollWidth, cw=chartScroll.clientWidth;
        dbg.textContent = `view=${view} preset=${preset} • visible=${visibleUnits} total=${currentTotalUnits} • vw=${vw().toFixed(2)} • content=${sw}px • px/u=${currentPxPerUnit.toFixed(4)} • max=${sw-cw}px`;
      }
    }

    // Initial layout
    recomputeLayout();

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => recomputeLayout());
    resizeObserver.observe(chartScroll);

    return () => {
      resizeObserver.disconnect();
    };
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
    const chart = document.getElementById('gantt-chart-scroll');
    const proxy = document.getElementById('gantt-hscroll-proxy');
    const timeline = document.getElementById('gantt-timeline-scroll');
    
    if (!chart || !proxy || !timeline) return;
    
    // Scroll sync (loop-safe)
    let syncing=false;
    function sync(from: HTMLElement, a: HTMLElement, b: HTMLElement){ 
      if(syncing) return; 
      syncing=true; 
      a.scrollLeft=from.scrollLeft; 
      b.scrollLeft=from.scrollLeft; 
      syncing=false; 
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

  return (
    <div id="gantt-container">
      {/* Header - Fixed */}
      <div id="gantt-header">
        <div id="gantt-header-row">
          {/* Left pane - Controls (20%, fixed width, pinned) */}
          <div id="gantt-controls-left">
            <div className="controls-row">
              <div className="ctrl">
                <label>View:</label>
                <select
                  value={viewConfig.type}
                  onChange={(e) => setViewConfig(prev => ({ ...prev, type: e.target.value as ViewConfig['type'] }))}
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