import React from 'react';
import { Resource } from '../types';

interface ResourceTableProps {
  resources: Resource[];
}

const ResourceTable: React.FC<ResourceTableProps> = ({ resources }) => {
  return (
    <div className="h-full">
      {resources.map((resource, index) => (
        <div
          key={resource.id}
          className={`flex items-center px-4 py-3 border-b border-gray-600 row ${
            index % 2 === 0 ? 'even' : 'odd'
          }`}
        >
          <div className="text-sm font-medium text-gray-200 truncate">
            {resource.name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResourceTable;