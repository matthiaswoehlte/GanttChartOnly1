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

    let view = viewConfig.type;
    let preset = viewConfig.preset;
    let selDate = viewConfig.selectedDate;

    const MS_H = 3600000, MS_D = 86400000;
    function startOfDay(d: Date){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
    function firstOfMonth(d: Date){ const x=startOfDay(d); x.setDate(1); return x; }
    function isoMonday(d: Date){ const x=startOfDay(d); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; }
    function daysInMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
    function vw(){ return chartScroll.getBoundingClientRect().width; }  // FRACTIONAL
    function parseNum(v: any){ if (typeof v==='number') return v; const m=String(v).match(/(\d+)/); return m?Number(m[1]):NaN; }
    function isFull(v: any){ return /full/i.test(String(v)); }

    // shared state
    let pxPerUnit = 0, totalUnits = 0, visibleUnits = 0;  // unit = hour (Hour) or day (Week/Month)

    // width applier (must hit ALL THREE content nodes)
    function applySharedWidth(px: number){
      const w = Math.ceil(px) + 2;  // +2 px safety to guarantee last pixel
      chartContent.style.width = chartContent.style.minWidth = w + 'px';
      timelineCont.style.width = timelineCont.style.minWidth = w + 'px';
      proxyInner.style.width   = w + 'px';
      document.documentElement.style.setProperty('--gantt-content-w', w + 'px');
    }
    
    // Clamp & realign after EVERY recompute
    function clampAndAlign(){
      requestAnimationFrame(()=>{
        const maxC = chartScroll.scrollWidth    - chartScroll.clientWidth;
        const maxT = timelineScroll.scrollWidth - timelineScroll.clientWidth;
        const maxP = proxyScroll.scrollWidth    - proxyScroll.clientWidth;

        // align all three to the smallest max so edges match
        const maxAll = Math.min(maxC, maxT, maxP);
        const target = Math.max(0, Math.min(chartScroll.scrollLeft, maxAll));
        chartScroll.scrollLeft   = target;
        timelineScroll.scrollLeft= target;
        proxyScroll.scrollLeft   = target;
      });
    }

    function layoutHour(){
      totalUnits = 24;
      const v = parseNum(preset);                 // 24|18|12|6|4, else NaN
      visibleUnits = (!v || Number.isNaN(v)) ? 24 : v;
      const contentWidth = vw() * (totalUnits / visibleUnits);  // ratio method
      applySharedWidth(contentWidth);
      pxPerUnit = contentWidth / totalUnits;

      const noScroll = visibleUnits === 24;
      chartScroll.style.overflowX = noScroll ? 'hidden' : 'auto';
      proxyScroll.style.display   = noScroll ? 'none'   : 'block';
    }

    function layoutWeek(){
      const days = /work/i.test(String(preset)) ? 5 : 7;  // default Full=7
      totalUnits = days; visibleUnits = days;
      const contentWidth = vw();                                    // no horizontal scroll
      applySharedWidth(contentWidth);
      pxPerUnit = contentWidth / totalUnits;
      chartScroll.style.overflowX = 'hidden';
      proxyScroll.style.display   = 'none';
      chartScroll.scrollLeft = 0; timelineScroll.scrollLeft = 0;
    }

    function layoutMonth(){
      const dim = daysInMonth(firstOfMonth(selDate));     // 28..31
      totalUnits = dim;
      if (isFull(preset)) visibleUnits = dim;
      else {
        const v = parseNum(preset);                       // 7|14|dim
        visibleUnits = (!v || Number.isNaN(v)) ? 14 : v;
        if (visibleUnits > totalUnits) visibleUnits = totalUnits;
      }
      const contentWidth = vw() * (totalUnits / visibleUnits);      // ratio → guarantees full span
      applySharedWidth(contentWidth);
      pxPerUnit = contentWidth / totalUnits;
      const scrollable = visibleUnits < totalUnits;
      chartScroll.style.overflowX = scrollable ? 'auto' : 'hidden';
      proxyScroll.style.display   = scrollable ? 'block' : 'none';
    }

    function recomputeLayout(){
      if (view === 'hour')  layoutHour();
      if (view === 'week')  layoutWeek();
      if (view === 'month') layoutMonth();
      clampAndAlign();
      
      // Update React state
      setPxPerUnit(pxPerUnit);
      setTotalUnits(totalUnits);
      
      // Call timeline alignment after layout changes
      if (window.__ganttAlignTimeline) {
        window.__ganttAlignTimeline();
      }
      
      // Debug: show mismatches immediately
      if (dbg){
        const csw = chartScroll.scrollWidth,  cCW = chartScroll.clientWidth;
        const tsw = timelineScroll.scrollWidth, tCW = timelineScroll.clientWidth;
        const psw = proxyScroll.scrollWidth,  pCW = proxyScroll.clientWidth;
        const mismatch = (csw !== tsw) || (csw !== psw);
        dbg.textContent = `vw=${vw().toFixed(2)} • total=${totalUnits} • visible=${visibleUnits} • px/u=${pxPerUnit.toFixed(4)} • chartSW=${csw} • timelineSW=${tsw} • proxySW=${psw} • MISMATCH=${mismatch}`;
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
    (function setupTimelineCalibration(){
    // Calibrate timeline alignment
      const timelineZero = document.getElementById('gantt-timeline-zero');
      const table     = document.getElementById('gantt-table-left');
      const chartView = document.getElementById('gantt-chart-scroll');
      if (!chartView || !timelineZero) return;
      const tContent  = document.getElementById('gantt-timeline-content');
      function measureAndApplyOffset(){
      function findBarStartX() {
        
        // 1) Find the visual bar start edge in the chart area:
        // Prefer a dedicated marker on the track; otherwise fall back to first bar.
        let barEdge =
          document.querySelector('[data-gantt-x0]') ||
          document.querySelector('.gantt-row-track') ||
          document.querySelector('.task-bar');
        return barEdge ? barEdge.getBoundingClientRect().left : null;
      }

      function measureAndApply() {
        if (!table || !chartView || !tContent) return;

        const dividerX   = Math.round(table.getBoundingClientRect().right); // the visual divider
        const timeline0X = Math.round(tContent.getBoundingClientRect().left); // current timeline zero
        const barStartX  = findBarStartX();

        // Prefer aligning to the bar start; if unknown, align to divider
        const targetX = (barStartX ?? dividerX);

        // Shift timeline so its zero coincides with targetX:
        let delta = 0;
        if (barEdge && timelineZero) {
          const barLeft   = barEdge.getBoundingClientRect().left;
          const zeroLeft  = timelineZero.getBoundingClientRect().left;
          delta = Math.round(barLeft - zeroLeft);           // positive → shift timeline LEFT by that much
        }
      // Run now & on layout changes
        // Apply to CSS var (negative/positive both ok)
        document.documentElement.style.setProperty('--gantt-xfix', delta + 'px');
      }
      new ResizeObserver(measureAndApply).observe(chartView);
      new ResizeObserver(measureAndApply).observe(table);
      // Run now, on resize and after fonts/layout changes
      measureAndApplyOffset();
      new ResizeObserver(measureAndApplyOffset).observe(chartView);
      window.addEventListener('resize', measureAndApplyOffset);

      // Expose for existing layout pipeline; call after recomputeLayout():
      window.__ganttCalibrateTimeline = measureAndApplyOffset;
      }
    })();
  }, []);

  // Timeline sync to bars scroller
  useEffect(() => {
    (function ganttTimelineSync(){
      const candidates = ['gantt-chart-scroll','gantt-body-scroll'];
      function getBarScroller(){
        // pick the first horizontally scrollable candidate
        for (const id of candidates){
          const el = document.getElementById(id);
          if (el && el.scrollWidth > el.clientWidth) return el;
        }
        // fallback: best guess inside body area
        const guess = document.querySelector('#gantt-root [data-role="bars"], #gantt-root [id*="chart"][id*="scroll"]');
        return (guess && guess.scrollWidth > guess.clientWidth) ? guess : null;
      }
      function bind(){
        const chart = getBarScroller();
        const time  = document.getElementById('gantt-timeline-scroll');
        if (!chart || !time) return false;
        if (chart.__syncBound) return true;
        chart.__syncBound = true;

        let ticking = false;
        chart.addEventListener('scroll', () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const x = chart.scrollLeft;
            if (time.scrollLeft !== x) time.scrollLeft = x;
            ticking = false;
          });
        }, { passive: true });

        // initial alignment after layout
        requestAnimationFrame(() => { time.scrollLeft = chart.scrollLeft; });
        return true;
      }

      // try now, then re-try on DOM mutations (framework remounts)
      if (!bind()){
        const mo = new MutationObserver(() => { bind(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
      }
    })();
  }, []);

  // Scroll sync (loop-safe, attach ONCE)
  useEffect(() => {
    const chart = document.getElementById('gantt-chart-scroll');
    const proxy = document.getElementById('gantt-hscroll-proxy');
    const timeline = document.getElementById('gantt-timeline-scroll');
    
    if (!chart || !proxy || !timeline) return;
    
    let syncing = false;
    function sync(from: HTMLElement, a: HTMLElement, b: HTMLElement){
      if (syncing) return; syncing = true;
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

  // Wire timeline scroller to follow bar scroller
  useEffect(() => {
    (function syncTimelineToChart(){
      const chart = document.getElementById('gantt-chart-scroll');
      const time  = document.getElementById('gantt-timeline-scroll');
      if (!chart || !time) return;

      // Prevent duplicate binding if this code runs more than once
      if (chart.__ganttSyncBound) return;
      chart.__ganttSyncBound = true;

      let lock = false;

      function follow(){
        if (lock) return;
        lock = true;
        // set only if different to avoid needless layout work
        const sl = chart.scrollLeft;
        if (time.scrollLeft !== sl) time.scrollLeft = sl;
        lock = false;
      }

      // One-way: bars → timeline
      chart.addEventListener('scroll', follow, { passive: true });

      // Initial alignment after current layout tick
      requestAnimationFrame(() => { time.scrollLeft = chart.scrollLeft; });
    })();

    // Multi-scroll sync for all horizontal scrollers
    (function syncAllGanttHScroll(){
      const ids = ['gantt-chart-scroll', 'gantt-timeline-scroll', 'gantt-proxy-scroll'];
      const els = ids.map(id => document.getElementById(id)).filter(Boolean);

      if (els.length < 2) return;  // nothing to sync

      // Avoid double-binding if this runs more than once
      if (window.__ganttHSyncBound) return;
      window.__ganttHSyncBound = true;

      let lock = false;

      function propagate(src){
        if (lock) return;
        lock = true;
        const x = src.scrollLeft;
        for (const el of els){
          if (el !== src && el.scrollLeft !== x) el.scrollLeft = x;
        }
        lock = false;
      }

      // Bind scroll on every present scroller
      for (const el of els){
        el.addEventListener('scroll', () => propagate(el), { passive: true });
      }

      // Initial alignment: use the max current scrollLeft
      requestAnimationFrame(() => {
        const start = Math.max(...els.map(e => e.scrollLeft || 0));
        els.forEach(e => e.scrollLeft = start);
      });
    })();
    // Robust scroll sync with DOM observation
    (function ensureGanttScrollSync(){
      const CHART_ID = 'gantt-chart-scroll';
      const TIME_ID  = 'gantt-timeline-scroll';

      // Avoid rebinding loops
      function bind(chart, time){
        if (!chart || !time) return false;
        if (chart.__ganttSyncBound) return true;
        chart.__ganttSyncBound = true;

        let ticking = false;
        function follow(){
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const sl = chart.scrollLeft;
            if (time.scrollLeft !== sl) time.scrollLeft = sl; // one-way: bars -> timeline
            ticking = false;
          });
        }
        chart.addEventListener('scroll', follow, { passive: true });

        // Align once after layout
        requestAnimationFrame(() => { time.scrollLeft = chart.scrollLeft; });

        return true;
      }

      // Try to bind now, then observe DOM for late mounts/re-mounts
      function tryBind(){
        const chart = document.getElementById(CHART_ID);
        const time  = document.getElementById(TIME_ID);
        if (bind(chart, time)) return true;
        return false;
      }

      // Attempt immediately and on DOM ready
      if (!tryBind()) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', tryBind, { once: true });
        }
      }

      // MutationObserver to catch mounts/re-mounts (e.g., framework rerenders)
      const mo = new MutationObserver(() => { tryBind(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });

      // Optional: public helper if your code switches views/presets and replaces nodes
      window.__ganttRebindScrollSync = tryBind;
    })();
  }, []);

  // Unified content width and end-reach fix
  useEffect(() => {
    (function exposeGanttWidthFix(){
      function parseHourPreset(preset){
        const m = String(preset).match(/(\d+)/);
        return m ? Math.max(1, parseInt(m[1],10)) : 24;
      }

      // call after du View/Preset/Month gesetzt und die Ticks/Bars gerendert hast
      window.ganttEnsureReachEnd = function ganttEnsureReachEnd(view, presetLabel, anchorDate){
        const chartScroll   = document.getElementById('gantt-chart-scroll');
        const chartContent  = document.getElementById('gantt-chart-content');
        const timeScroll    = document.getElementById('gantt-timeline-scroll');
        const timeContent   = document.getElementById('gantt-timeline-content');
        if(!chartScroll || !chartContent || !timeScroll || !timeContent) return;

        // 1) Bestimme total/visible
        let totalUnits=24, visibleUnits=24;
        if (view === 'Hour'){
          totalUnits = 24;
          visibleUnits = parseHourPreset(presetLabel);                 // 24|18|12|6|4
        } else if (view === 'Month'){
          const d = anchorDate instanceof Date ? anchorDate : new Date();
          const y = d.getFullYear(), m = d.getMonth();
          totalUnits = new Date(y, m+1, 0).getDate();                  // 28..31
          visibleUnits = /14/.test(presetLabel) ? 14 : /7/.test(presetLabel) ? 7 : totalUnits;
        } else {
          // Week ist hier nicht horizontal scrollend; nichts zu tun
          return;
        }

        // 2) Breite deterministisch (Viewport × Ratio), EIN Wert für beide Contents
        const viewportPx = chartScroll.clientWidth || 0;
        const contentPx  = Math.max(0, Math.round(viewportPx * (totalUnits / Math.max(1,visibleUnits))));
        chartContent.style.width  = contentPx + 'px';
        timeContent.style.width   = contentPx + 'px';

        // 3) Optional: pxPerUnit global merken, falls Bars/Ticks ihn brauchen
        window.__ganttPxPerUnit = contentPx / totalUnits;

        // 4) Scrollstand validieren + Sync (Bars -> Timeline)
        requestAnimationFrame(() => {
          const maxChart = chartScroll.scrollWidth - chartScroll.clientWidth;
          if (chartScroll.scrollLeft > maxChart) chartScroll.scrollLeft = maxChart;
          if (timeScroll.scrollLeft  !== chartScroll.scrollLeft) timeScroll.scrollLeft = chartScroll.scrollLeft;
        });
      };
    })();

    // Content width equalization and two-way scroll sync
    (function fixGanttWidthAndSync(){
      const IDS = {
        chartScroll:  'gantt-chart-scroll',
        chartContent: 'gantt-chart-content',
        timeScroll:   'gantt-timeline-scroll',
        timeContent:  'gantt-timeline-content',
      };

      function px(n){ return Math.max(0, Math.round(n||0)); }

      function getContentWidth(el){
        // prefer explicit style width, then scrollWidth, then box width
        const styleW = parseFloat(el.style.width) || 0;
        const sw = el.scrollWidth || 0;
        const box = el.getBoundingClientRect ? el.getBoundingClientRect().width : 0;
        return Math.max(styleW, sw, box);
      }

      function equalizeWidths(){
        const cc = document.getElementById(IDS.chartContent);
        const tc = document.getElementById(IDS.timeContent);
        if (!cc || !tc) return false;

        // Use the larger width as single source of truth (usually timeline is larger)
        const target = px(Math.max(getContentWidth(tc), getContentWidth(cc)));
        cc.style.width    = target + 'px';
        cc.style.minWidth = target + 'px';
        tc.style.width    = target + 'px';
        tc.style.minWidth = target + 'px';
        return true;
      }

      function wireSync(){
        const cs = document.getElementById(IDS.chartScroll);
        const ts = document.getElementById(IDS.timeScroll);
        if (!cs || !ts) return;

        // Ensure both are horizontally scrollable when needed
        cs.style.overflowX = cs.style.overflowX || 'auto';
        ts.style.overflowX = ts.style.overflowX || 'auto';

        // Prevent duplicate binding
        if (cs.__ganttSyncBound && ts.__ganttSyncBound) return;
        cs.__ganttSyncBound = ts.__ganttSyncBound = true;

        let lock = false;
        function link(from, to){
          if (lock) return;
          lock = true;
          const x = from.scrollLeft;
          if (to.scrollLeft !== x) to.scrollLeft = x;
          lock = false;
        }

        cs.addEventListener('scroll', () => link(cs, ts), { passive:true });
        ts.addEventListener('scroll', () => link(ts, cs), { passive:true });

        // Initial alignment after layout
        requestAnimationFrame(() => { ts.scrollLeft = cs.scrollLeft; });
      }

      // Run once now; if elements mount later, re-run when DOM changes
      function run(){
        if (equalizeWidths()) wireSync();
      }
      run();

      const mo = new MutationObserver(run);
      mo.observe(document.documentElement, { childList:true, subtree:true });
    })();
  }, []);

  // Timeline DOM protection and restoration
  useEffect(() => {
    (function ensureTimelineDom(){
      // Header-Rechts als Host
      let host = document.getElementById('gantt-header-right')
               || document.querySelector('#gantt-header-grid > :nth-child(2)');
      if(!host) return null;

      // Scroller
      let sc = document.getElementById('gantt-timeline-scroll');
      if(!sc){
        sc = document.createElement('div');
        sc.id = 'gantt-timeline-scroll';
        sc.style.overflowX = 'auto';
        sc.style.overflowY = 'hidden';
        sc.style.width = '100%';
        host.appendChild(sc);
      }

      // Content
      let ct = document.getElementById('gantt-timeline-content');
      if(!ct){
        ct = document.createElement('div');
        ct.id = 'gantt-timeline-content';
        ct.style.position = 'relative';
        ct.style.height = '48px';
        sc.appendChild(ct);
      }
      // Sicherstellen, dass er sichtbar bleibt
      ct.style.position = 'relative';
      ct.style.height = ct.style.height || '48px';
      return { scroller: sc, content: ct };
    })();

    // Render: Stunde 0..24 inkl. Rand bei exakt x = contentWidth
    window.renderHourTimelineFixed = function renderHourTimelineFixed(pxPerHour, contentWidthPx){
      const host = document.getElementById('gantt-header-right')
                || document.querySelector('#gantt-header-grid > :nth-child(2)');
      if(!host) return;

      let sc = document.getElementById('gantt-timeline-scroll');
      if(!sc){
        sc = document.createElement('div');
        sc.id = 'gantt-timeline-scroll';
        sc.style.overflowX = 'auto';
        sc.style.overflowY = 'hidden';
        sc.style.width = '100%';
        host.appendChild(sc);
      }

      let ct = document.getElementById('gantt-timeline-content');
      if(!ct){
        ct = document.createElement('div');
        ct.id = 'gantt-timeline-content';
        ct.style.position = 'relative';
        ct.style.height = '48px';
        sc.appendChild(ct);
      }
      ct.style.position = 'relative';
      ct.style.height = ct.style.height || '48px';

      const root = ct;
      const W = Math.max(0, Math.round(contentWidthPx));
      const TOTAL = 24;

      // Breite setzen (damit es wirklich scrollt)
      root.style.width = W + 'px';
      root.style.minWidth = W + 'px';

      // Inhalt neu aufbauen
      root.textContent = '';
      // Major ticks 0..24
      for(let h=0; h<=TOTAL; h++){
        const x = Math.round(h * pxPerHour);
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:#394454;`;
        root.appendChild(line);
      }
      // Minor ticks (Halbstunden), nur innerhalb [0, W)
      for(let h=0; h<TOTAL; h++){
        const x = Math.round(h*pxPerHour + pxPerHour/2);
        if(x>=0 && x<W){
          const m = document.createElement('div');
          m.style.cssText = `position:absolute;left:${x}px;top:0;height:50%;width:1px;background:#475569;`;
          root.appendChild(m);
        }
      }
      // Labels: 0 linksbündig, 24 rechtsbündig, dazwischen mittig
      for(let h=0; h<=TOTAL; h++){
        const x = Math.round(h * pxPerHour);
        const lab = document.createElement('div');
        lab.textContent = String(h).padStart(2,'0');
        lab.style.position = 'absolute';
        lab.style.top = '4px';
        lab.style.left = x + 'px';
        lab.style.whiteSpace = 'nowrap';
        if(h===0){ lab.style.transform = 'translateX(0)'; }
        else if(h===TOTAL){ lab.style.transform = 'translateX(-100%)'; }
        else { lab.style.transform = 'translateX(-50%)'; }
        root.appendChild(lab);
      }
    };

    // Breite aus Bars übernehmen und Scroll-Sync Bars -> Timeline setzen
    (function restoreTimeline(){
      const host = document.getElementById('gantt-header-right')
                || document.querySelector('#gantt-header-grid > :nth-child(2)');
      if(!host) return;

      let sc = document.getElementById('gantt-timeline-scroll');
      if(!sc){
        sc = document.createElement('div');
        sc.id = 'gantt-timeline-scroll';
        sc.style.overflowX = 'auto';
        sc.style.overflowY = 'hidden';
        sc.style.width = '100%';
        host.appendChild(sc);
      }

      let ct = document.getElementById('gantt-timeline-content');
      if(!ct){
        ct = document.createElement('div');
        ct.id = 'gantt-timeline-content';
        ct.style.position = 'relative';
        ct.style.height = '48px';
        sc.appendChild(ct);
      }
      ct.style.position = 'relative';
      ct.style.height = ct.style.height || '48px';

      const tl = { scroller: sc, content: ct };

      const chartScroll  = document.getElementById('gantt-chart-scroll');
      const chartContent = document.getElementById('gantt-chart-content');
      if(!chartScroll || !chartContent) return;

      // Content-Breiten angleichen: Timeline = Bars
      const W = parseInt(chartContent.style.width||0,10) || chartContent.scrollWidth || chartContent.clientWidth;
      if(W>0){
        tl.content.style.width = W + 'px';
        tl.content.style.minWidth = W + 'px';
        // px/h exakt aus Contentbreite ableiten
        const pxPerHour = W / 24;
        if (window.renderHourTimelineFixed) {
          window.renderHourTimelineFixed(pxPerHour, W);
        }
      }

      // Einseitiger Scroll-Sync (idempotent)
      if(!chartScroll.__ganttSyncBound){
        chartScroll.__ganttSyncBound = true;
        chartScroll.addEventListener('scroll', () => {
          if (tl.scroller.scrollLeft !== chartScroll.scrollLeft) {
            tl.scroller.scrollLeft = chartScroll.scrollLeft;
          }
        }, { passive:true });
        // initiale Ausrichtung
        requestAnimationFrame(()=>{ tl.scroller.scrollLeft = chartScroll.scrollLeft; });
      }
    })();
  }, []);

  // Timeline rendering functions
  useEffect(() => {
    // Pure JS renderers for Hour and Month views
    window.renderHourTimeline = function(pxPerHour, contentWidthPx) {
      const root = document.getElementById('gantt-timeline-content');
      if (!root) return;
      root.innerHTML = '';

      const TOTAL = 24;
      const W = Math.round(contentWidthPx ?? (pxPerHour * TOTAL));
      const H = 48; // visual height area for ticks/labels

      // major ticks at every hour, include BOTH ends: 0 and 24
      for (let h = 0; h <= TOTAL; h++){
        const x = Math.round(h * pxPerHour);
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:#394454;`;
        root.appendChild(line);
      }

      // minor ticks at half hours (inside bounds only)
      for (let h = 0; h < TOTAL; h++){
        const x = Math.round(h * pxPerHour + pxPerHour / 2);
        if (x >= 0 && x < W){
          const minor = document.createElement('div');
          minor.style.cssText = `position:absolute;left:${x}px;top:0;height:${H/2}px;width:1px;background:#475569;`;
          root.appendChild(minor);
        }
      }

      // labels: first at 0 (no shift), last at W (right aligned), middle centered
      for (let h = 0; h <= TOTAL; h++){
        const x = Math.round(h * pxPerHour);
        const lab = document.createElement('div');
        lab.className = 'gantt-tick--label';
        lab.textContent = String(h).padStart(2,'0');
        lab.style.position = 'absolute';
        lab.style.top = '4px';
        lab.style.left = x + 'px';
        if (h === 0){
          lab.style.transform = 'translateX(0)';              // align to left edge
        } else if (h === TOTAL){
          lab.style.transform = 'translateX(-100%)';          // align to right edge
        } else {
          lab.style.transform = 'translateX(-50%)';           // centered
        }
        root.appendChild(lab);
      }
    };

    window.renderMonthTimeline = function(pxPerDay, daysInMonth, contentWidthPx) {
      const root = document.getElementById('gantt-timeline-content');
      if (!root) return;
      root.innerHTML = '';

      const TOTAL = daysInMonth;
      const W = Math.round(contentWidthPx ?? (pxPerDay * TOTAL));

      // grid lines at day edges 0..TOTAL (include right edge)
      for (let d = 0; d <= TOTAL; d++){
        const x = Math.round(d * pxPerDay);
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:#394454;`;
        root.appendChild(line);
      }

      // day labels centered in cells 1..TOTAL
      for (let d = 1; d <= TOTAL; d++){
        const cx = Math.round((d - 0.5) * pxPerDay);
        if (cx >= 0 && cx <= W){
          const lab = document.createElement('div');
          lab.className = 'gantt-tick--label';
          lab.textContent = String(d);
          lab.style.cssText = `position:absolute;top:4px;left:${cx}px;transform:translateX(-50%);`;
          root.appendChild(lab);
        }
      }
    };
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