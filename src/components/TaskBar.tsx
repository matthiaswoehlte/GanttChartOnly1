import React, { useState, useRef } from 'react';
import { Task, ViewConfig } from '../types';
import { getTimelineConfig, snapToMinutes } from '../utils/chartUtils';
import { differenceInHours, addHours, getStartOfDay, getStartOfWeek, getStartOfMonth, getDaysInMonth } from '../utils/dateUtils';

interface TaskBarProps {
  task: Task;
  viewConfig: ViewConfig;
  pxPerUnit: number;
  totalUnits: number;
  rowIndex: number;
  onUpdate: (updatedTask: Task) => void;
  onMove: (taskId: string, newResourceId: string) => void;
  resources: Array<{ id: string; name: string }>;
}

const TaskBar: React.FC<TaskBarProps> = ({
  task,
  viewConfig,
  pxPerUnit,
  totalUnits,
  rowIndex,
  onUpdate,
  onMove,
  resources
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({
    visible: false,
    x: 0,
    y: 0,
    text: ''
  });
  const barRef = useRef<HTMLDivElement>(null);
  
  // Calculate anchor times based on view type
  const getAnchorTime = () => {
    const { selectedDate, type } = viewConfig;
    switch (type) {
      case 'hour':
        return getStartOfDay(selectedDate);
      case 'week':
        return getStartOfWeek(selectedDate);
      case 'month':
        return getStartOfMonth(selectedDate);
      default:
        return new Date();
    }
  };
  
  const anchorTime = getAnchorTime();
  
  // Calculate position and width using SAME pxPerUnit (exact same as layout engine)
  const MS_H = 3600000, MS_D = 86400000;
  let left, width;
  
  if (viewConfig.type === 'hour') {
    // Hour: x = ((start - startOfDay(selDate)) / MS_H) * pxPerUnit; w = ((end - start)/MS_H) * pxPerUnit
    left = ((task.startDate.getTime() - anchorTime.getTime()) / MS_H) * pxPerUnit;
    width = ((task.endDate.getTime() - task.startDate.getTime()) / MS_H) * pxPerUnit;
  } else if (viewConfig.type === 'week') {
    // Week: x = ((start - isoMonday(selDate)) / MS_D) * pxPerUnit; w = ((end - start)/MS_D) * pxPerUnit
    left = ((task.startDate.getTime() - anchorTime.getTime()) / MS_D) * pxPerUnit;
    width = ((task.endDate.getTime() - task.startDate.getTime()) / MS_D) * pxPerUnit;
  } else {
    // Month: x = ((start - firstOfMonth(selDate)) / MS_D) * pxPerUnit; w = ((end - start)/MS_D)*pxPerUnit
    left = ((task.startDate.getTime() - anchorTime.getTime()) / MS_D) * pxPerUnit;
    width = ((task.endDate.getTime() - task.startDate.getTime()) / MS_D) * pxPerUnit;
  }
  

  const formatTooltipDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateTooltip = (e: MouseEvent, startDate: Date, endDate: Date) => {
    const tooltipText = `${formatTooltipDate(startDate)} - ${formatTooltipDate(endDate)}`;
    setTooltip({
      visible: true,
      x: e.clientX + 10,
      y: e.clientY - 30,
      text: tooltipText
    });
  };

  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if clicking near edges for resize
    if (mouseX <= 8) {
      setIsResizing('left');
      return;
    } else if (mouseX >= rect.width - 8) {
      setIsResizing('right');
      return;
    }
    
    // Otherwise, start dragging
    setIsDragging(true);
    setDragOffset({ x: mouseX, y: mouseY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging && !isResizing) return;
    
    const chartContainer = document.querySelector('#gantt-chart-scroll');
    const chartRect = chartContainer?.getBoundingClientRect();
    if (!chartRect) return;
    
    if (isDragging) {
      const newLeft = e.clientX - chartRect.left - dragOffset.x;
      let newUnitsFromAnchor = Math.max(0, newLeft / pxPerUnit);
      
      // High-resolution dragging - no snapping during drag
      const msPerUnit = viewConfig.type === 'hour' ? 3600000 : 86400000; // ms per hour or day
      const currentUnitsFromAnchor = (task.startDate.getTime() - anchorTime.getTime()) / msPerUnit;
      const deltaMs = (newUnitsFromAnchor - currentUnitsFromAnchor) * msPerUnit;
      const newStartDate = new Date(task.startDate.getTime() + deltaMs);
      const newEndDate = new Date(task.endDate.getTime() + deltaMs);
      
      // Update tooltip during drag
      updateTooltip(e, newStartDate, newEndDate);
      
      // Constrain within timeline bounds
      const durationUnits = (task.endDate.getTime() - task.startDate.getTime()) / msPerUnit;
      const constrainedUnits = Math.min(newUnitsFromAnchor, totalUnits - durationUnits);
      
      const constrainedStartDate = new Date(anchorTime.getTime() + constrainedUnits * msPerUnit);
      const constrainedEndDate = new Date(constrainedStartDate.getTime() + durationUnits * msPerUnit);
      
      onUpdate({
        ...task,
        startDate: constrainedStartDate,
        endDate: constrainedEndDate
      });
    } else if (isResizing) {
      const mouseX = e.clientX - chartRect.left;
      
      if (isResizing === 'right') {
        const minWidth = viewConfig.type === 'hour' ? pxPerUnit * 0.5 : pxPerUnit * 0.1; // 30 min or 2.4 hours
        const newWidth = Math.max(minWidth, mouseX - left);
        const newDuration = newWidth / pxPerUnit;
        const msPerUnit = viewConfig.type === 'hour' ? 3600000 : 86400000;
        const newEndDate = new Date(task.startDate.getTime() + newDuration * msPerUnit);
        
        updateTooltip(e, task.startDate, newEndDate);
        
        onUpdate({
          ...task,
          endDate: newEndDate
        });
      } else if (isResizing === 'left') {
        const newLeft = Math.max(0, mouseX);
        const newUnitsFromAnchor = newLeft / pxPerUnit;
        const msPerUnit = viewConfig.type === 'hour' ? 3600000 : 86400000;
        const newStartDate = new Date(anchorStart + newUnitsFromAnchor * msPerUnit);
        
        if (newStartDate < task.endDate) {
          updateTooltip(e, newStartDate, task.endDate);
          
          onUpdate({
            ...task,
            startDate: newStartDate
          });
        }
      }
    }
    
    // Check for row change during drag
    if (isDragging) {
      const rowHeight = 40;
      const newRowIndex = Math.floor((e.clientY - chartRect.top) / rowHeight);
      
      if (newRowIndex >= 0 && newRowIndex < resources.length && newRowIndex !== rowIndex) {
        onMove(task.id, resources[newRowIndex].id);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging || isResizing) {
      // Snap to 5-minute increments on release
      const snappedStartMs = snapToMinutes(task.startDate.getTime(), 5);
      const snappedEndMs = snapToMinutes(task.endDate.getTime(), 5);
      
      const snappedTask = {
        ...task,
        startDate: new Date(snappedStartMs),
        endDate: new Date(snappedEndMs)
      };
      
      onUpdate(snappedTask);
      console.log('Task persisted:', snappedTask);
    }
    
    setIsDragging(false);
    setIsResizing(null);
    hideTooltip();
  };

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, task, viewConfig, pxPerUnit, totalUnits]);

  return (
    <>
      <div
        ref={barRef}
        className={`absolute h-8 rounded shadow-lg border border-opacity-50 cursor-pointer select-none task-bar ${
          isDragging ? 'dragging' : ''
        } ${isResizing ? 'cursor-col-resize' : 'cursor-move'}`}
        style={{
          left: Math.max(0, left),
          width: Math.max(24, width),
          backgroundColor: task.color,
          borderColor: task.color,
          top: '6px'
        }}
        onMouseDown={handleMouseDown}
        title={`${task.title} (${task.startDate.toLocaleString()} - ${task.endDate.toLocaleString()})`}
      >
        <div className="flex items-center justify-center h-full px-2">
          <span className="text-xs font-medium text-white truncate">
            {task.title}
          </span>
        </div>
        
        {/* Resize handles */}
        <div className="resize-handle left" />
        <div className="resize-handle right" />
      </div>
      
      {/* Live tooltip during drag */}
      {tooltip.visible && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
};

export default TaskBar;