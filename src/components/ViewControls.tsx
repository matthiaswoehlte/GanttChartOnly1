import React from 'react';
import { ViewConfig, ViewType, HourPreset, WeekPreset, MonthPreset } from '../types';

interface ViewControlsProps {
  viewConfig: ViewConfig;
  onViewConfigChange: (config: ViewConfig) => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({
  viewConfig,
  onViewConfigChange
}) => {
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
    
    onViewConfigChange({
      ...viewConfig,
      type,
      preset
    });
  };

  const handlePresetChange = (preset: HourPreset | WeekPreset | MonthPreset) => {
    onViewConfigChange({
      ...viewConfig,
      preset
    });
  };

  const renderPresetOptions = () => {
    switch (viewConfig.type) {
      case 'hour':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => handlePresetChange(e.target.value as HourPreset)}
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
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
            onChange={(e) => handlePresetChange(e.target.value as WeekPreset)}
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
          >
            <option value="Work Week">Work Week</option>
            <option value="Full Week">Full Week</option>
          </select>
        );
      case 'month':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => handlePresetChange(e.target.value as MonthPreset)}
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
          >
            <option value="7 Days">7 Days</option>
            <option value="14 Days">14 Days</option>
            <option value="Full Month">Full Month</option>
          </select>
        );
    }
  };

  return (
    <div className="flex items-center gap-4 mb-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 font-medium">View:</label>
        <select
          value={viewConfig.type}
          onChange={(e) => handleViewTypeChange(e.target.value as ViewType)}
          className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
        >
          <option value="hour">Hour</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-300 font-medium">Preset:</label>
        {renderPresetOptions()}
      </div>
    </div>
  );
};

export default ViewControls;