/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type RecurringInterval = 'none' | 'daily' | 'weekly' | 'monthly';

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
  remarks: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string; // ISO string
  subtasks: SubTask[];
  remarks: string;
  isRecurring: boolean;
  recurringInterval: RecurringInterval;
  createdAt: string;
  updatedAt: string;
}

export type ViewType = 'board' | 'calendar';
