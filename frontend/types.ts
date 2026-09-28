export interface Person {
  id: number;
  name: string;
}

export interface ProjectRef {
  id: number;
  name: string;
  color: string;
  isInbox: boolean;
}

export interface LabelRef {
  id: number;
  name: string;
  color: string;
}

export type Priority = 1 | 2 | 3 | 4;

/** A task as every list shows it; mirrors taskRow() in src/tasks/serializers.ts. */
export interface TaskRow {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  recurrence: string | null;
  project: ProjectRef;
  sectionId: number | null;
  parentId: number | null;
  labels: LabelRef[];
  assignee: Person | null;
  subtasks: { done: number; total: number } | null;
  comments: number;
  position: number;
  completedAt: string | null;
  updatedAt: string;
  /** Only in a shared project's `changes`: gone for good. */
  deletedAt?: string | null;
}

export interface TaskDetail extends TaskRow {
  subtaskRows: TaskRow[];
  parent: { id: number; title: string } | null;
  section: { id: number; name: string } | null;
  /** Who can be assigned; empty when the project isn't shared. */
  people: Person[];
}

export interface CommentRow {
  id: number;
  taskId: number;
  body: string;
  author: Person | null;
  file: { name: string; size: number; isImage: boolean; url: string } | null;
  createdAt: string;
}

export interface SidebarProject extends ProjectRef {
  viewStyle: 'list' | 'board';
  favorite: boolean;
  shared: boolean;
  mine: boolean;
}

/** Props every page gets: `auth` from MvcModule, the rest from SharedDataMiddleware. */
export interface SharedProps {
  auth: { user: { id: number; name: string; email: string } | null };
  today: string;
  counts: {
    inbox: number;
    today: number;
    projects: Record<number, number>;
  } | null;
  sidebar: {
    projects: SidebarProject[];
    labels: LabelRef[];
    filters: { id: number; name: string; color: string }[];
  } | null;
  [key: string]: unknown;
}

/** What a list page may carry for the task dialog (see src/tasks/task-detail.ts). */
export interface DetailProps {
  task?: TaskDetail | null;
  comments?: CommentRow[];
  commentsCursor?: string;
}
