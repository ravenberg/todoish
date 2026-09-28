import { router } from 'nestjs-mvc/react';
import type { TaskDetail, TaskRow } from '../types';

/**
 * The props that hold tasks on each page. Actions reload just these (plus
 * the sidebar counts), so the rest of the page isn't sent again: a partial
 * reload, the server runs only the closures it's asked for.
 */
const LISTS: Record<string, string[]> = {
  'Tasks/Inbox': ['tasks'],
  'Tasks/Today': ['tasks'],
  'Upcoming/Index': ['days', 'overdue'],
  'Projects/Show': ['tasks', 'sections', 'changes', 'cursor'],
  'Filters/Show': ['tasks'],
  'Labels/Show': ['tasks'],
};

/**
 * The page component the user is on. The layout writes it on every visit,
 * so actions started from a dialog or a menu know which lists to reload.
 */
let component = '';
export const setCurrentComponent = (name: string) => {
  component = name;
};

/** What an action on a task reloads: the lists here, the counts, and the open task. */
export function reloadAfterTaskChange() {
  return [...(LISTS[component] ?? []), 'counts', 'task'];
}

type Props = Record<string, unknown>;

interface Days {
  data: { date: string; tasks: TaskRow[] }[];
}

/**
 * Applies `edit` to every list of tasks a page holds, whatever its shape:
 * a plain `tasks` array, Upcoming's `days` and `overdue`, a shared
 * project's `changes` map. Only the props it changes are returned, which is
 * what `router.optimistic()` wants.
 */
function everyList(props: Props, edit: (tasks: TaskRow[]) => TaskRow[]): Props {
  const out: Props = {};
  if (Array.isArray(props.tasks)) out.tasks = edit(props.tasks as TaskRow[]);
  if (Array.isArray(props.overdue))
    out.overdue = edit(props.overdue as TaskRow[]);
  const days = props.days as Days | undefined;
  if (days?.data)
    out.days = {
      ...days,
      data: days.data.map((day) => ({ ...day, tasks: edit(day.tasks) })),
    };
  const changes = props.changes as Record<string, TaskRow> | undefined;
  if (changes && Object.keys(changes).length) {
    const kept = edit(Object.values(changes));
    out.changes = Object.fromEntries(kept.map((t) => [t.id, t]));
  }
  return out;
}

/** The open task dialog's copy: the task itself, or one of its sub-tasks. */
function inDialog(props: Props, id: number, patch: Partial<TaskRow>): Props {
  const task = props.task as TaskDetail | null | undefined;
  if (!task) return {};
  if (task.id === id) return { task: { ...task, ...patch } };
  if (task.subtaskRows.some((t) => t.id === id))
    return {
      task: {
        ...task,
        subtaskRows: task.subtaskRows.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      },
    };
  return {};
}

export const withoutTask = (props: Props, id: number) => ({
  ...everyList(props, (tasks) =>
    tasks.filter((t) => t.id !== id && t.parentId !== id),
  ),
  ...inDialog(props, id, { completedAt: new Date().toISOString() }),
});

export const patchTask = (
  props: Props,
  id: number,
  patch: Partial<TaskRow>,
) => ({
  ...everyList(props, (tasks) =>
    tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  ),
  ...inDialog(props, id, patch),
});

const options = () => ({
  only: reloadAfterTaskChange(),
  preserveScroll: true,
  preserveState: true,
});

/**
 * The circle. The task leaves the list the moment you click (`optimistic`);
 * if the server says no, it comes back. A recurring task isn't removed: the
 * server moves it to its next date and the reload shows where it went.
 */
export function completeTask(task: TaskRow) {
  const request = task.recurrence
    ? router
    : router.optimistic((props: Props) => withoutTask(props, task.id));
  request.post(`/tasks/${task.id}/complete`, {}, options());
}

export function reopenTask(id: number) {
  router.post(`/tasks/${id}/reopen`, {}, options());
}

/**
 * A change from the dialog or a row's menu. `preview` is how the task looks
 * once it's saved, when that differs from what's sent (labels go as names,
 * come back as objects).
 */
export function updateTask(
  task: TaskRow,
  changes: Record<string, unknown>,
  preview: Partial<TaskRow> = changes as Partial<TaskRow>,
) {
  router
    .optimistic((props: Props) => patchTask(props, task.id, preview))
    .patch(`/tasks/${task.id}`, changes as Record<string, string>, {
      ...options(),
      errorBag: 'task',
    });
}

export function deleteTask(task: TaskRow, onSuccess?: () => void) {
  router
    .optimistic((props: Props) => withoutTask(props, task.id))
    .delete(`/tasks/${task.id}`, { ...options(), onSuccess });
}

/**
 * Drag and drop: into a section, above another task (or at the end).
 * The list reorders at once; positions between neighbours are enough for
 * the page to sort, and the server renumbers them properly.
 */
export function moveTask(
  task: TaskRow,
  to: { sectionId: number | null; before: TaskRow | null },
) {
  router
    .optimistic((props: Props) =>
      everyList(props, (tasks) => {
        const target = to.before;
        const inSection = tasks.filter(
          (t) =>
            t.sectionId === to.sectionId && t.id !== task.id && !t.parentId,
        );
        let position: number;
        if (target) {
          const index = inSection.findIndex((t) => t.id === target.id);
          const above = inSection[index - 1];
          position = above
            ? (above.position + target.position) / 2
            : target.position - 1;
        } else {
          position = Math.max(0, ...inSection.map((t) => t.position)) + 1;
        }
        return tasks.map((t) =>
          t.id === task.id ? { ...t, sectionId: to.sectionId, position } : t,
        );
      }),
    )
    .post(
      `/tasks/${task.id}/move`,
      {
        projectId: task.project.id,
        sectionId: to.sectionId,
        before: to.before?.id ?? null,
      },
      options(),
    );
}

/** The URL of this page with `?task=` set to `id`, or taken out. */
function withTask(id: number | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('task', String(id));
  else url.searchParams.delete('task');
  return url.pathname + url.search;
}

/**
 * Opens the task dialog: `?task=12` in the address bar (so it's a link you
 * can share or reload), and a partial reload for just the task and its
 * comments. The list underneath isn't touched. `reset` starts the comments
 * over, because they're `prepend()`ed and these are another task's.
 */
export function openTask(id: number) {
  router.get(
    withTask(id),
    {},
    {
      only: ['task', 'comments', 'commentsCursor'],
      reset: ['comments'],
      preserveState: true,
      preserveScroll: true,
    },
  );
}

export function closeTask() {
  router.get(
    withTask(null),
    {},
    {
      only: ['task'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
    },
  );
}

/**
 * The order the tasks are shown in, so the dialog's up and down arrows go
 * to the one above or below. Each list writes it as it renders.
 */
let order: number[] = [];
export const setTaskOrder = (ids: number[]) => {
  order = ids;
};
export const neighbours = (id: number) => {
  const index = order.indexOf(id);
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index !== -1 && index < order.length - 1 ? order[index + 1] : null,
  };
};

/** Top-level tasks, each followed by its sub-tasks, for lists that nest. */
export function nest(tasks: TaskRow[]) {
  const ids = new Set(tasks.map((t) => t.id));
  const roots = tasks.filter((t) => !t.parentId || !ids.has(t.parentId));
  return roots.map((task) => ({
    task,
    children: tasks.filter((t) => t.parentId === task.id),
  }));
}

export const byPosition = (a: TaskRow, b: TaskRow) =>
  a.position - b.position || a.id - b.id;
