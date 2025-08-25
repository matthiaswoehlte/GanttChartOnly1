import React from 'react';
import { Task, Resource, ViewConfig } from '../types';
import { getStartOfDay, getStartOfWeek, getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';
import TaskBar from './TaskBar';

interface ChartAreaProps {
  tasks: Task[];
  resources: Resource[];
  viewConfig: ViewConfig;
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskMove: (taskId: string, newResourceId: string) => void;
  pxPerUnit: number;
  totalUnits: number;
}

const ChartArea: React.FC<ChartAreaProps> = ({
  tasks,
  resources,
  viewConfig,
  onTaskUpdate,
  onTaskMove,
  pxPerUnit,
  totalUnits
}) => {

  // Calculate visible time range based on view type
  const getVisibleTimeRange = () => {
    const { selectedDate, type, preset } = viewConfig;
    
    switch (type) {
      case 'hour': {
        const startTime = getStartOfDay(selectedDate);
        const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
        return { startTime, endTime };
      }
      case 'week': {
        const startTime = getStartOfWeek(selectedDate);
        const visibleDays = preset === 'full' ? 7 : 5;
        const endTime = new Date(startTime.getTime() + visibleDays * 24 * 60 * 60 * 1000);
        return { startTime, endTime };
      }
      case 'month': {
        const startTime = getStartOfMonth(selectedDate);
        const endTime = getEndOfMonth(selectedDate);
        return { startTime, endTime };
      }
      default:
        return { startTime: new Date(), endTime: new Date() };
    }
  };

  const { startTime: visibleStart, endTime: visibleEnd } = getVisibleTimeRange();

  // Filter tasks to only show those that overlap with the visible time range
  const isTaskVisible = (task: Task) => {
    return task.endDate > visibleStart && task.startDate < visibleEnd;
  };

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
  
  // Time to position functions - NO scrollLeft subtraction, content-relative positioning
  const timeToX = (startDate: Date) => {
    const startMs = startDate.getTime();
    const anchorMs = anchorTime.getTime();
    
    if (viewConfig.type === 'hour') {
      return ((startMs - anchorMs) / 3600000) * pxPerUnit; // hours since start-of-day
    } else {
      return ((startMs - anchorMs) / 86400000) * pxPerUnit; // days since anchor
    }
  };
  
  const durToW = (startDate: Date, endDate: Date) => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const units = viewConfig.type === 'hour' ? 
      (endMs - startMs) / 3600000 : 
      (endMs - startMs) / 86400000;
    return Math.max(1, units * pxPerUnit);
  };

  return (
    <div id="gantt-chart-content">
      {resources.map((resource, rowIndex) => {
        // Render ALL tasks for this resource - no horizontal virtualization
        const resourceTasks = tasks.filter(task => task.resourceId === resource.id);
        
        return (
          <div 
            key={resource.id}
            className="gantt-row"
            data-row={rowIndex}
          >
            <div className="gantt-row-bars">
              {resourceTasks.map(task => {
                // Position relative to content origin (x=0), never subtract scrollLeft
                const left = Math.round(timeToX(task.startDate));
                const width = Math.round(durToW(task.startDate, task.endDate));
                const isShort = width < 32;
                
                return (
                  <div
                    key={task.id}
                    className={`gantt-bar ${isShort ? 'gantt-bar--short' : ''}`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      backgroundColor: task.color,
                      borderColor: task.color
                    }}
                    title={`${task.title} (${task.startDate.toLocaleString()} - ${task.endDate.toLocaleString()})`}
                  >
                    <span className="gantt-bar-label">
                      {task.title}
                    </span>
                    <TaskBar
                      task={task}
                      viewConfig={viewConfig}
                      pxPerUnit={pxPerUnit}
                      totalUnits={totalUnits}
                      rowIndex={rowIndex}
                      onUpdate={onTaskUpdate}
                      onMove={onTaskMove}
                      resources={resources}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChartArea;