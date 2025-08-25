import { Resource, Task } from '../types';

const TASK_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
];

const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah',
  'Ivan', 'Julia', 'Kevin', 'Luna', 'Marcus', 'Nina', 'Oliver', 'Petra',
  'Quentin', 'Rachel', 'Samuel', 'Tara', 'Ulrich', 'Vera', 'Walter', 'Xena',
  'Yusuf', 'Zara', 'Adrian', 'Bella', 'Cedric', 'Delia', 'Ethan', 'Grace',
  'Hugo', 'Iris', 'Jake', 'Kate', 'Leo', 'Maya', 'Noah', 'Opal'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

const TASK_NAMES = [
  'Planning', 'Development', 'Testing', 'Review', 'Documentation', 'Meeting',
  'Research', 'Implementation', 'Design', 'Analysis', 'Training', 'Deployment',
  'Maintenance', 'Support', 'Integration', 'Optimization', 'Debugging', 'Setup',
  'Configuration', 'Monitoring'
];

export const generateResources = (count: number): Resource[] => {
  const resources: Resource[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    
    resources.push({
      id: `resource-${i + 1}`,
      name: `${firstName} ${lastName}`
    });
  }
  
  return resources;
};

export const generateTasks = (resources: Resource[]): Task[] => {
  const tasks: Task[] = [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  resources.forEach((resource, resourceIndex) => {
    const taskCount = Math.floor(Math.random() * 11) + 5; // 5-15 tasks per resource
    
    for (let i = 0; i < taskCount; i++) {
      // Random day in the current month
      const dayOffset = Math.floor(Math.random() * daysInMonth);
      const startHour = Math.floor(Math.random() * 20); // 0-19 hours (leave room for duration)
      const duration = Math.floor(Math.random() * 6) + 1; // 1-6 hours
      
      const startDate = new Date(startOfMonth);
      startDate.setDate(startDate.getDate() + dayOffset);
      startDate.setHours(startHour, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + duration);
      
      const taskName = TASK_NAMES[Math.floor(Math.random() * TASK_NAMES.length)];
      const color = TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)];
      
      tasks.push({
        id: `task-${resourceIndex + 1}-${i + 1}`,
        resourceId: resource.id,
        title: `${taskName} ${i + 1}`,
        startDate,
        endDate,
        color
      });
    }
  });
  
  return tasks;
};