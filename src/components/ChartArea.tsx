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
  
  // Time to position functions using SAME pxPerUnit as timeline
  const timeToX = (startDate: Date) => {
    const MS_H = 3600000, MS_D = 86400000;
    if (viewConfig.type === 'hour') {
      return ((startDate.getTime() - anchorTime.getTime()) / MS_H) * pxPerUnit;
    } else {
      return ((startDate.getTime() - anchorTime.getTime()) / MS_D) * pxPerUnit;
    }
  };
  
  const timeToW = (startDate: Date, endDate: Date) => {
    const MS_H = 3600000, MS_D = 86400000;
    if (viewConfig.type === 'hour') {
      return ((endDate.getTime() - startDate.getTime()) / MS_H) * pxPerUnit;
    } else {
      return ((endDate.getTime() - startDate.getTime()) / MS_D) * pxPerUnit;
    }
  };
  return (
    <div id="gantt-chart-content">
      {resources.map((resource, rowIndex) => {
        const resourceTasks = tasks.filter(task => 
          task.resourceId === resource.id && isTaskVisible(task)
        );
        
        return (
          <div 
            key={resource.id}
            className="gantt-row"
            data-row={rowIndex}
          >
            <div className="gantt-row-bars">
              {resourceTasks.map(task => {
                const left = timeToX(task.startDate);
                const width = timeToW(task.startDate, task.endDate);
                const isShort = width < 32;
                
                return (
                  <div
                    key={task.id}
                    className={`gantt-bar ${isShort ? 'gantt-bar--short' : ''}`}
                    style={{
                      left: `${Math.max(0, left)}px`,
                      width: `${Math.max(24, width)}px`,
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