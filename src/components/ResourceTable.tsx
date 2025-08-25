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
          className="table-row flex items-center px-4"
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