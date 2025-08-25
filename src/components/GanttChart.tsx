import React, { useState, useRef, useEffect } from 'react';
import { Task, Resource, ViewConfig } from '../types';
import { generateResources, generateTasks } from '../data/sampleData';
import TimelineRuler from './TimelineRuler';
import ResourceTable from './ResourceTable';
import ChartArea from './ChartArea';

// Hour labels without ":00"
const formatHourLabel = (h: number): string => {
  return String(h).padStart(2, '0'); // "00".."23"
};

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

  const handleViewTypeChange = (type: 'hour' | 'week' | 'month') => {
    let preset: string;
    
    switch (type) {
      case 'hour':
        preset = '24 Hours';
        break;
      case 'week':
        preset = 'Full Week';
        break;
      case 'month':
        preset = 'Full Month';
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
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value})}
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
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value})}
          >
            <option value="Work Week">Work Week</option>
            <option value="Full Week">Full Week</option>
          </select>
        );
      case 'month':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => setViewConfig({...viewConfig, preset: e.target.value})}
          >
            <option value="7 Days">7 Days</option>
            <option value="14 Days">14 Days</option>
            <option value="Full Month">Full Month</option>
          </select>
        );
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, 1); // month is 0-indexed
    setViewConfig(prev => ({
      ...prev,
      selectedDate: newDate
    }));
  };

  // Apply shared content width to both timeline and chart
  const applyContentWidthByRatio = (view: string, preset: string, viewportPx: number) => {
    const chartContent = document.getElementById('gantt-chart-content');
    const timelineContent = document.getElementById('gantt-timeline-content');
    
    if (!chartContent || !timelineContent) return { pxPerUnit: 0, totalUnits: 0, contentPx: 0 };

    let totalUnits, visibleUnits;
    
    if (view === 'hour') {
      totalUnits = 24;
      const match = String(preset).match(/(\d+)/);
      visibleUnits = match ? parseInt(match[1], 10) : 24; // 24|18|12|6|4
    } else if (view === 'month') {
      const dim = new Date(viewConfig.selectedDate.getFullYear(), viewConfig.selectedDate.getMonth() + 1, 0).getDate();
      totalUnits = dim;
      if (/14/.test(preset)) visibleUnits = 14;
      else if (/7/.test(preset)) visibleUnits = 7;
      else visibleUnits = dim; // Full Month
    } else {
      // Week view - no scrolling
      totalUnits = /work/i.test(preset) ? 5 : 7;
      visibleUnits = totalUnits;
    }

    const contentPx = viewportPx * (totalUnits / visibleUnits);
    const w = Math.ceil(contentPx) + 2;
    
    chartContent.style.width = w + 'px';
    timelineContent.style.width = w + 'px';

    const pxPerUnit = contentPx / totalUnits;
    return { pxPerUnit, totalUnits, visibleUnits, contentPx: w };
  };

  // ===== RATIO-BASED LAYOUT ENGINE =====
  useEffect(() => {
    const chartScroll    = document.getElementById('gantt-chart-scroll');
    const chartContent   = document.getElementById('gantt-chart-content');
    const timelineScroll = document.getElementById('gantt-timeline-scroll');
    const timelineContent = document.getElementById('gantt-timeline-content');

    if (!chartScroll || !chartContent || !timelineScroll || !timelineContent) {
      return;
    }

    let view = viewConfig.type;
    let preset = viewConfig.preset;
    let selDate = viewConfig.selectedDate;

    const MS_H = 3600000, MS_D = 86400000;
    function startOfDay(d: Date){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
    function firstOfMonth(d: Date){ const x=startOfDay(d); x.setDate(1); return x; }
    function isoMonday(d: Date){ const x=startOfDay(d); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; }
    function daysInMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
    function vw(){ return chartScroll.getBoundingClientRect().width; }  // FRACTIONAL
    function parseHourPreset(preset: any){ if (typeof preset==='number') return preset; const m=String(preset).match(/(\d+)/); return m?Number(m[1]):24; }
    function isFull(v: any){ return /full/i.test(String(v)); }

    // shared state
    let pxPerUnit = 0, totalUnits = 0, visibleUnits = 0;  // unit = hour (Hour) or day (Week/Month)

    // Clamp & realign after EVERY recompute
    function clampAndAlign(){
      requestAnimationFrame(()=>{
        const maxC = chartScroll.scrollWidth    - chartScroll.clientWidth;
        const maxT = timelineScroll.scrollWidth - timelineScroll.clientWidth;

        // align all three to the smallest max so edges match
        const maxAll = Math.min(maxC, maxT);
        const target = Math.max(0, Math.min(chartScroll.scrollLeft, maxAll));
        chartScroll.scrollLeft   = target;
        timelineScroll.scrollLeft= target;
      });
    }

    function layoutHour(){
      totalUnits = 24;
      const match = String(preset).match(/(\d+)/);
      visibleUnits = match ? parseInt(match[1], 10) : 24; // 24|18|12|6|4
      const result = applyContentWidthByRatio('hour', preset, vw());
      pxPerUnit = result.pxPerUnit;

      const noScroll = visibleUnits === 24;
      chartScroll.style.overflowX = noScroll ? 'hidden' : 'auto';
      timelineScroll.style.overflowX = noScroll ? 'hidden' : 'auto';
    }

    function layoutWeek(){
      const days = /work/i.test(String(preset)) ? 5 : 7;  // default Full=7
      totalUnits = days; visibleUnits = days;
      const result = applyContentWidthByRatio('week', preset, vw());
      pxPerUnit = result.pxPerUnit;
      chartScroll.style.overflowX = 'hidden';
      timelineScroll.style.overflowX = 'hidden';
      chartScroll.scrollLeft = 0; timelineScroll.scrollLeft = 0;
    }

    function layoutMonth(){
      const dim = daysInMonth(firstOfMonth(selDate));     // 28..31
      totalUnits = dim;
      if (isFull(preset)) visibleUnits = dim;
      else {
        if (/14/.test(preset)) visibleUnits = 14;
        else if (/7/.test(preset)) visibleUnits = 7;
        else visibleUnits = 14; // fallback
        if (visibleUnits > totalUnits) visibleUnits = totalUnits;
      }
      const result = applyContentWidthByRatio('month', preset, vw());
      pxPerUnit = result.pxPerUnit;
      const scrollable = visibleUnits < totalUnits;
      chartScroll.style.overflowX = scrollable ? 'auto' : 'hidden';
      timelineScroll.style.overflowX = scrollable ? 'auto' : 'hidden';
    }

    // Render timeline ticks
    function renderTimeline() {
      if (!timelineContent) return;
      timelineContent.innerHTML = '';

      function labelHour(h: number) { return String(h).padStart(2, '0'); }
      function addTick(x: number, label: string | null, cls?: string) {
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = `${Math.round(x)}px`;
        line.style.top = '0';
        line.style.bottom = '0';
        line.style.width = '1px';
        line.style.background = '#394454';
        timelineContent.appendChild(line);
        
        if (label != null) {
          const span = document.createElement('div');
          span.textContent = label;
          span.className = cls || '';
          span.style.position = 'absolute';
          span.style.top = '4px';
          span.style.left = `${Math.round(x)}px`;
          span.style.fontSize = '12px';
          span.style.color = '#cbd5e1';
          span.style.transform = cls === 'gantt-tick--first' ? 'translateX(0)' : 
                                (cls === 'gantt-tick--last' ? 'translateX(-100%)' : 'translateX(-50%)');
          timelineContent.appendChild(span);
        }
      }

      if (view === 'hour') {
        for (let h = 0; h <= 24; h++) {
          const x = h * pxPerUnit;
          const cls = h === 0 ? 'gantt-tick--first' : (h === 24 ? 'gantt-tick--last' : '');
          addTick(x, h === 0 || h === 24 ? labelHour(h % 24) : labelHour(h), cls);
        }
      } else if (view === 'week') {
        const start = new Date(selDate);
        const wd = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - wd); // ISO Monday
        const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (let d = 0; d <= totalUnits; d++) {
          const x = d * pxPerUnit;
          const cls = d === 0 ? 'gantt-tick--first' : (d === totalUnits ? 'gantt-tick--last' : '');
          addTick(x, d < totalUnits ? `${names[d % 7]}` : names[(d - 1) % 7], cls);
        }
      } else if (view === 'month') {
        // C) Month timeline: vertical lines at cell edges 0..dim
        for (let i = 0; i <= totalUnits; i++) {
          const x = Math.round(i * pxPerUnit);
          const line = document.createElement('div');
          line.style.cssText = `position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:#394454;`;
          timelineContent.appendChild(line);
        }
        // Labels centered in each cell: 1..dim
        for (let day = 1; day <= totalUnits; day++) {
          const cx = Math.round((day - 0.5) * pxPerUnit);
          const lab = document.createElement('div');
          lab.textContent = String(day);
          lab.style.cssText = `position:absolute;left:${cx}px;top:4px;font-size:12px;color:#cbd5e1;transform:translateX(-50%);`;
          timelineContent.appendChild(lab);
        }
      }
    }

    function recomputeLayout(){
      if (view === 'hour')  layoutHour();
      if (view === 'week')  layoutWeek();
      if (view === 'month') layoutMonth();
      clampAndAlign();
      renderTimeline();
      
      // Update React state
      setPxPerUnit(pxPerUnit);
      setTotalUnits(totalUnits);
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

  // Scroll sync (loop-safe, attach ONCE)
  useEffect(() => {
    const chart = document.getElementById('gantt-chart-scroll');
    const timeline = document.getElementById('gantt-timeline-scroll');
    
    if (!chart || !timeline) return;
    
    let syncing = false;
    function sync(from: HTMLElement, to: HTMLElement){
      if (syncing) return; syncing = true;
      to.scrollLeft = from.scrollLeft;
      syncing = false;
    }
    
    const syncFromChart = () => sync(chart, timeline);
    const syncFromTimeline = () => sync(timeline, chart);
    
    chart.addEventListener('scroll', syncFromChart, { passive: true });
    timeline.addEventListener('scroll', syncFromTimeline, { passive: true });
    
    return () => {
      chart.removeEventListener('scroll', syncFromChart);
      timeline.removeEventListener('scroll', syncFromTimeline);
    };
  }, []);

  return (
    <div id="gantt-root">
      {/* Header - Sticky */}
      <div id="gantt-header">
        <div id="gantt-header-grid">
          {/* Left column - 20% */}
          <div id="gantt-title">
            <h2 className="text-lg font-semibold text-gray-200">Resources</h2>
          </div>
          
          {/* Right column - 80% */}
          <div id="gantt-header-right">
            <div id="gantt-controls" className="mb-3">
              <div className="flex items-center gap-2">
                <label>View:</label>
                <select
                  value={viewConfig.type}
                  onChange={(e) => handleViewTypeChange(e.target.value as 'hour' | 'week' | 'month')}
                >
                  <option value="hour">Hour</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label>Preset:</label>
                {renderPresetOptions()}
              </div>
              
              <div className="flex items-center gap-2">
                <label>Month:</label>
                <input
                  id="gantt-month"
                  type="month"
                  value={`${viewConfig.selectedDate.getFullYear()}-${(viewConfig.selectedDate.getMonth() + 1).toString().padStart(2, '0')}`}
                  onChange={handleMonthChange}
                />
              </div>
              
            </div>
            
            {/* Timeline Ruler */}
            <div id="gantt-timeline-scroll">
              <div id="gantt-timeline-content">
                {/* Timeline content will be rendered by the layout engine */}
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
      </div>
    </div>
  );
};

export default GanttChart;