import React from 'react';
import { Task, Resource, ViewConfig } from '../types';
import TaskBar from './TaskBar';
import { getStartOfDay, getStartOfWeek, getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';

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

  return (
    <div className="relative h-full" style={{ width: totalUnits * pxPerUnit }}>
      {resources.map((resource, rowIndex) => {
        const resourceTasks = tasks.filter(task => 
          task.resourceId === resource.id && isTaskVisible(task)
        );
        
        return (
          <div
            key={resource.id}
            className={`relative border-b border-gray-600 row gantt-row-track ${
              rowIndex % 2 === 0 ? 'even' : 'odd'
            }`}
            data-gantt-x0
          >
            {resourceTasks.map(task => (
              <TaskBar
                key={task.id}
                task={task}
                viewConfig={viewConfig}
                pxPerUnit={pxPerUnit}
                totalUnits={totalUnits}
                rowIndex={rowIndex}
                onUpdate={onTaskUpdate}
                onMove={onTaskMove}
                resources={resources}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default ChartArea;