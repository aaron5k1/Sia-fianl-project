/**
 * ZenTask Harmony - A Minimalist Task Manager
 * 
 * Features:
 * - Kanban Board (Trello-like)
 * - Calendar View
 * - Subtasks with completion and remarks
 * - Recurring Tasks (Daily, Weekly, Monthly)
 * - Dark Mode / Light Mode
 * - Modern Glassy UI using Tailwind CSS
 * - Client-side persistence via LocalStorage
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Plus, 
  Moon, 
  Sun, 
  Search,
  CheckCircle2,
  Clock,
  User,
  MoreVertical,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, 
  addDays, startOfWeek, endOfWeek, addMonths, subMonths, isToday, parseISO 
} from 'date-fns';
import { Task, ViewType, TaskStatus, Priority, RecurringInterval } from './types';
import { cn } from './lib/utils';

// --- Storage Utilities ---
const STORAGE_KEY = 'zentask_harmony_data';

const getInitialTasks = (): Task[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved tasks', e);
      return [];
    }
  }
  
  // Default Sample Tasks
  const now = new Date();
  return [
    {
      id: crypto.randomUUID(),
      title: 'Welcome to ZenTask! 🚀',
      description: 'Explore the board, create new tasks, and try switching to Calendar view.',
      assignee: 'ZenBot',
      status: 'todo',
      priority: 'high',
      deadline: addDays(now, 2).toISOString(),
      subtasks: [
        { id: '1', title: 'Create your first task', isCompleted: false, remarks: 'Click the New Task button' },
        { id: '2', title: 'Toggle Dark Mode', isCompleted: false, remarks: 'Check the sidebar moon icon' }
      ],
      remarks: 'We hope you enjoy this clean interface!',
      isRecurring: false,
      recurringInterval: 'none',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'Weekly Team Sync',
      description: 'Review progress and discuss next steps.',
      assignee: 'Design Team',
      status: 'in-progress',
      priority: 'medium',
      deadline: addDays(now, 5).toISOString(),
      subtasks: [],
      remarks: '',
      isRecurring: true,
      recurringInterval: 'weekly',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
  ];
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(getInitialTasks);
  const [currentView, setCurrentView] = useState<ViewType>('board');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('zentask_theme');
    return saved === 'dark';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Theme Sync ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zentask_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zentask_theme', 'light');
    }
  }, [darkMode]);

  /**
   * Sync tasks to local storage whenever the tasks state changes.
   * This ensures data persistence across page reloads.
   */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  /**
   * Recurring Tasks Logic:
   * Periodically checks for tasks marked as 'recurring' that have been completed.
   * If the now > deadline, it generates the next occurrence of that task.
   */
  useEffect(() => {
    const checkRecurring = () => {
      const now = new Date();
      setTasks(prev => {
        let changed = false;
        const newTasks = prev.map(task => {
          if (task.isRecurring && task.status === 'done' && task.deadline) {
            const deadline = parseISO(task.deadline);
            if (now > deadline) {
              // Create next instance
              let nextDeadline = deadline;
              if (task.recurringInterval === 'daily') nextDeadline = addDays(deadline, 1);
              if (task.recurringInterval === 'weekly') nextDeadline = addDays(deadline, 7);
              if (task.recurringInterval === 'monthly') nextDeadline = addMonths(deadline, 1);
              
              changed = true;
              return {
                ...task,
                id: crypto.randomUUID(),
                status: 'todo' as TaskStatus,
                deadline: nextDeadline.toISOString(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                subtasks: task.subtasks.map(st => ({ ...st, isCompleted: false }))
              };
            }
          }
          return task;
        });
        return changed ? [...prev, ...newTasks.filter(nt => !prev.some(pt => pt.id === nt.id))] : prev;
      });
    };

    const timer = setInterval(checkRecurring, 1000 * 60 * 60); // Check every hour
    return () => clearInterval(timer);
  }, []);

  /**
   * Task Actions: Create, Update, Delete
   * These functions handle the CRUD operations of the application.
   */
  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      assignee: taskData.assignee || 'Unassigned',
      status: 'todo',
      priority: taskData.priority || 'medium',
      deadline: taskData.deadline || new Date().toISOString(),
      subtasks: taskData.subtasks || [],
      remarks: taskData.remarks || '',
      isRecurring: taskData.isRecurring || false,
      recurringInterval: taskData.recurringInterval || 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks([...tasks, newTask]);
    setIsModalOpen(false);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    setEditingTask(null);
    setIsModalOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  /**
   * Filtered Tasks: Used for search functionality.
   * Searches through titles and assignees.
   */
  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 transition-colors duration-300 font-sans relative overflow-hidden">
      {/* Background Mesh Gradients */}
      <div className="mesh-gradient-1" />
      <div className="mesh-gradient-2" />

      {/* Sidebar / Navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-64 border-r border-white/10 bg-white/5 backdrop-blur-2xl z-40 p-4 flex flex-col items-center md:items-stretch">
        <div className="flex items-center gap-3 mb-10 px-2 mt-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <CheckCircle2 size={24} />
          </div>
          <span className="hidden md:block text-xl font-bold tracking-tight text-white">ZenTask</span>
        </div>

        <div className="space-y-2 flex-grow">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Board" 
            active={currentView === 'board'} 
            onClick={() => setCurrentView('board')} 
          />
          <NavItem 
            icon={<CalendarIcon size={20} />} 
            label="Calendar" 
            active={currentView === 'calendar'} 
            onClick={() => setCurrentView('calendar')} 
          />
        </div>

        <div className="pt-4 border-t border-white/5 space-y-4">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
          >
            {darkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-400" />}
            <span className="hidden md:block font-medium">{darkMode ? 'Light Theme' : 'Glass Theme'}</span>
          </button>
          
          <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10">
            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden ring-1 ring-white/20">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-white">Alex Rivera</p>
              <p className="text-xs text-slate-500 tracking-wider font-bold">PRO ACCOUNT</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 md:pl-64 min-h-screen relative z-10">
        <header className="sticky top-0 z-30 bg-[#0f172a]/40 backdrop-blur-md px-4 md:px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{currentView === 'board' ? 'Task Board' : 'Calendar View'}</h1>
            <p className="text-slate-400 text-sm font-medium mt-1">Ready to be productive? You have {tasks.filter(t => t.status !== 'done').length} tasks pending.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Find a task..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all w-full md:w-64 text-slate-200"
              />
            </div>
            <button 
              onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full flex items-center gap-2 font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-95 glassy-btn"
            >
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </header>

        <div className="px-4 md:px-8 pb-10 pt-8">
          <AnimatePresence mode="wait">
            {currentView === 'board' ? (
              <BoardView 
                tasks={filteredTasks} 
                onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} 
                onDelete={handleDeleteTask}
                onUpdateStatus={(id, status) => handleUpdateTask(id, { status })}
              />
            ) : (
              <CalendarView 
                tasks={filteredTasks} 
                onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Task Modal */}
      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }} 
        onSave={editingTask ? (data) => handleUpdateTask(editingTask.id, data) : handleAddTask}
        initialData={editingTask || undefined}
      />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-center md:justify-start gap-4 p-3 rounded-xl transition-all duration-300",
        active 
          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" 
          : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
      )}
    >
      <div className={cn(active && "text-indigo-400")}>{icon}</div>
      <span className={cn("hidden md:block font-bold", active && "text-white")}>{label}</span>
    </button>
  );
}

// --- Views Components ---

function BoardView({ tasks, onEdit, onDelete, onUpdateStatus }: { tasks: Task[], onEdit: (t: Task) => void, onDelete: (id: string) => void, onUpdateStatus: (id: string, s: TaskStatus) => void }) {
  const columns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'indigo' },
    { id: 'in-progress', label: 'In Progress', color: 'amber' },
    { id: 'done', label: 'Completed', color: 'emerald' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {columns.map(col => (
        <div key={col.id} className="flex flex-col h-full min-h-[500px]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", `bg-${col.color}-500`)} />
              <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs">{col.label}</h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">
                {tasks.filter(t => t.status === col.id).length}
              </span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><MoreVertical size={16} /></button>
          </div>
          
          <div className="flex-grow space-y-4 rounded-2xl bg-slate-100/50 dark:bg-slate-800/30 p-2 overflow-y-auto">
            {tasks.filter(t => t.status === col.id).map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onEdit={onEdit} 
                onDelete={onDelete} 
                onStatusChange={onUpdateStatus}
              />
            ))}
            {tasks.filter(t => t.status === col.id).length === 0 && (
              <div className="h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                Drop tasks here
              </div>
            )}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function TaskCard({ task, onEdit, onDelete, onStatusChange }: { task: Task, onEdit: (t: Task) => void, onDelete: (id: string) => void, onStatusChange: (id: string, s: TaskStatus) => void }) {
  const priorityColors = {
    low: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    medium: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    high: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
  };

  const deadline = parseISO(task.deadline);
  const isOverdue = deadline < new Date() && task.status !== 'done';

  return (
    <motion.div 
      layout
      className="group glass-card p-5 rounded-3xl shadow-lg shadow-black/10 cursor-grab active:cursor-grabbing border-white/10"
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={cn("text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border tracking-widest", priorityColors[task.priority])}>
          {task.priority}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="text-slate-500 hover:text-rose-400"
          >
            <Plus size={16} className="rotate-45" />
          </button>
        </div>
      </div>

      <h4 className="font-bold text-lg mb-2 text-white leading-tight transition-colors group-hover:text-indigo-400 font-sans tracking-tight">{task.title}</h4>
      <p className="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed font-medium">{task.description}</p>

      {task.subtasks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-widest">
            <span>Milestones</span>
            <span className="text-slate-300">{Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-700 ease-out" 
              style={{ width: `${(task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
            {task.assignee.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{task.assignee}</span>
        </div>
        
        <div className={cn("flex items-center gap-1 text-[10px] font-bold", isOverdue ? "text-rose-400" : "text-slate-500")}>
          <Clock size={12} className={isOverdue ? "animate-pulse" : ""} />
          {format(deadline, 'MMM dd')}
        </div>
      </div>
    </motion.div>
  );
}

function CalendarView({ tasks, onEdit }: { tasks: Task[], onEdit: (t: Task) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl"
    >
      <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
        <h2 className="text-2xl font-extrabold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-5 py-2 text-sm font-bold bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10"
          >
            Today
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-white/5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-black/20">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[140px]">
        {days.map((day, i) => {
          const dayTasks = tasks.filter(t => isSameDay(parseISO(t.deadline), day));
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const is_today = isToday(day);

          return (
            <div 
              key={day.toISOString()} 
              className={cn(
                "p-3 border-r border-b border-white/5 overflow-hidden group hover:bg-white/5 transition-colors",
                !isCurrentMonth && "opacity-20",
                i % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn(
                  "text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                  is_today && "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 scale-110",
                  !is_today && "text-slate-400"
                )}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />}
              </div>
              
              <div className="space-y-1.5">
                {dayTasks.slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    onClick={() => onEdit(task)}
                    className={cn(
                      "text-[10px] px-2.5 py-1.5 rounded-lg truncate cursor-pointer transition-all border",
                      task.status === 'done' 
                        ? "bg-black/20 text-slate-500 line-through border-transparent" 
                        : "bg-indigo-500/10 text-indigo-300 font-bold border-indigo-500/20 hover:border-indigo-400"
                    )}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-slate-500 pl-2 font-black uppercase tracking-wider">
                    + {dayTasks.length - 3} tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// --- Task Modal ---
function TaskModal({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (data: Partial<Task>) => void, initialData?: Task }) {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    assignee: '',
    priority: 'medium',
    deadline: new Date().toISOString().split('T')[0],
    subtasks: [],
    remarks: '',
    isRecurring: false,
    recurringInterval: 'none',
    status: 'todo'
  });

  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        deadline: initialData.deadline.split('T')[0]
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assignee: '',
        priority: 'medium',
        deadline: new Date().toISOString().split('T')[0],
        subtasks: [],
        remarks: '',
        isRecurring: false,
        recurringInterval: 'none',
        status: 'todo'
      });
    }
  }, [initialData, isOpen]);

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormData({
      ...formData,
      subtasks: [
        ...(formData.subtasks || []),
        { id: crypto.randomUUID(), title: newSubtask, isCompleted: false, remarks: '' }
      ]
    });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks?.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s)
    });
  };

  const removeSubtask = (id: string) => {
    setFormData({ ...formData, subtasks: formData.subtasks?.filter(s => s.id !== id) });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white/10 backdrop-blur-3xl w-full max-w-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden max-h-[90vh] flex flex-col border border-white/20"
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-white tracking-tight">{initialData ? 'Edit Task' : 'New Mission'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white">
            <Plus className="rotate-45" size={28} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What is the objective?"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-bold text-xl text-white placeholder:text-slate-600"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Assignee</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    placeholder="Team member"
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-semibold text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Deadline</label>
                <div className="relative">
                  <CalendarIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="date" 
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-semibold text-white color-scheme-dark"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Priority</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                  className="w-full p-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all cursor-pointer font-bold text-white appearance-none"
                >
                  <option value="low" className="bg-[#0f172a]">Low</option>
                  <option value="medium" className="bg-[#0f172a]">Medium</option>
                  <option value="high" className="bg-[#0f172a]">High</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                  className="w-full p-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all cursor-pointer font-bold text-white appearance-none"
                >
                  <option value="todo" className="bg-[#0f172a]">To Do</option>
                  <option value="in-progress" className="bg-[#0f172a]">In Progress</option>
                  <option value="done" className="bg-[#0f172a]">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Recurring</label>
                <select 
                  value={formData.recurringInterval}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    recurringInterval: e.target.value as RecurringInterval,
                    isRecurring: e.target.value !== 'none'
                  })}
                  className="w-full p-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all cursor-pointer font-bold text-white appearance-none"
                >
                  <option value="none" className="bg-[#0f172a]">Off</option>
                  <option value="daily" className="bg-[#0f172a]">Daily</option>
                  <option value="weekly" className="bg-[#0f172a]">Weekly</option>
                  <option value="monthly" className="bg-[#0f172a]">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mission details..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none font-medium text-white placeholder:text-slate-600"
              />
            </div>

            {/* Subtasks Section */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">Subtasks & Milestones</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
                  placeholder="Define subtask..."
                  className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500/50 transition-all font-bold text-white placeholder:text-slate-700"
                />
                <button 
                  onClick={addSubtask}
                  className="bg-indigo-600/20 text-indigo-400 p-3 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all border border-indigo-500/30 active:scale-90"
                  title="Add subtask"
                >
                  <Plus size={24} />
                </button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {formData.subtasks?.map(st => (
                  <div key={st.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl group hover:border-indigo-500/40 transition-all space-y-3">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleSubtask(st.id)}
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0",
                          st.isCompleted ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "border-2 border-white/10 hover:border-emerald-500/50"
                        )}
                      >
                        {st.isCompleted && <CheckCircle2 size={14} />}
                      </button>
                      <span className={cn("flex-grow text-sm font-bold", st.isCompleted ? "line-through text-slate-600" : "text-slate-200")}>{st.title}</span>
                      <button 
                        onClick={() => removeSubtask(st.id)}
                        className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove subtask"
                      >
                        <Plus size={18} className="rotate-45" />
                      </button>
                    </div>
                    {/* Subtask Remarks */}
                    <input 
                      type="text"
                      value={st.remarks || ''}
                      placeholder="Add a remark..."
                      onChange={(e) => {
                        const newSubtasks = formData.subtasks?.map(s => s.id === st.id ? { ...s, remarks: e.target.value } : s);
                        setFormData({ ...formData, subtasks: newSubtasks });
                      }}
                      className="w-full text-[11px] bg-white/5 rounded-lg py-2 px-3 border border-transparent focus:border-white/10 outline-none text-slate-400 font-medium placeholder:text-slate-700"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 block">Additional Remarks</label>
              <textarea 
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Final notes..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none font-medium text-white placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-white/10 flex gap-4 bg-black/20">
          <button 
            onClick={onClose}
            className="flex-grow py-4 rounded-2xl font-black text-slate-400 hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/10"
          >
            DISCARD
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-grow py-4 rounded-2xl font-black bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] active:scale-95 glassy-btn uppercase tracking-widest text-sm"
          >
            {initialData ? 'Update Mission' : 'Deploy Task'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

