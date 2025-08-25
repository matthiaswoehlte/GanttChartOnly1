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
        preset = '24h' as HourPreset;
        break;
      case 'week':
        preset = 'full' as WeekPreset;
        break;
      case 'month':
        preset = 'full' as MonthPreset;
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
            <option value="4h">4 Hours</option>
            <option value="6h">6 Hours</option>
            <option value="12h">12 Hours</option>
            <option value="18h">18 Hours</option>
            <option value="24h">24 Hours</option>
          </select>
        );
      case 'week':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => handlePresetChange(e.target.value as WeekPreset)}
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
          >
            <option value="work">Work Week</option>
            <option value="full">Full Week</option>
          </select>
        );
      case 'month':
        return (
          <select
            value={viewConfig.preset}
            onChange={(e) => handlePresetChange(e.target.value as MonthPreset)}
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
          >
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="full">Full Month</option>
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