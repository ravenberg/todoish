import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { type DragEvent, type ReactNode, useState } from 'react';
import { type QuickAddDefaults, openQuickAdd } from '../lib/quickAdd';
import { moveTask, nest } from '../lib/tasks';
import type { TaskRow } from '../types';
import { TASK_MIME, TaskItem } from './TaskItem';

/** "+ Add task" at the end of a list, the way Todoist has it. */
export function AddTaskRow({
  defaults,
  label = 'Add task',
}: {
  defaults?: QuickAddDefaults;
  label?: string;
}) {
  return (
    <UnstyledButton
      className="add-task-row"
      onClick={() => openQuickAdd(defaults)}
      py={8}
      w="100%"
    >
      <Group gap={10}>
        <span className="add-task-plus">
          <IconPlus size={14} stroke={2.5} />
        </span>
        <Text size="sm" c="dimmed" className="add-task-label">
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Tasks, each followed by its sub-tasks. With `sectionId` set (a project
 * page), rows can be dragged to another place, in this list or another
 * section's: the drop goes above the row it lands on.
 */
export function TaskList({
  tasks,
  showProject = false,
  showDate = true,
  sectionId,
  add,
  empty,
  allTasks,
}: {
  tasks: TaskRow[];
  showProject?: boolean;
  showDate?: boolean;
  /** Set to make the list a drop target (null is "no section"). */
  sectionId?: number | null;
  add?: QuickAddDefaults | false;
  empty?: ReactNode;
  /** Every task on the page, to find the one being dragged in. */
  allTasks?: TaskRow[];
}) {
  const [over, setOver] = useState<number | 'end' | null>(null);
  const sortable = sectionId !== undefined;
  const find = (event: DragEvent) =>
    (allTasks ?? tasks).find(
      (t) => t.id === Number(event.dataTransfer.getData(TASK_MIME)),
    );

  const drop = (before: TaskRow | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(null);
    const task = find(event);
    if (!task || task.id === before?.id) return;
    moveTask(task, { sectionId: sectionId ?? null, before });
  };
  const dragOver = (target: number | 'end') => (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(TASK_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setOver(target);
  };

  const rows = nest(tasks);
  return (
    <Box
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOver(null);
      }}
    >
      {rows.length === 0 && empty}
      {rows.map(({ task, children }) => (
        <Box key={task.id} className="task-group">
          <TaskItem
            task={task}
            showProject={showProject}
            showDate={showDate}
            draggable={sortable}
            onDragOver={sortable ? dragOver(task.id) : undefined}
            onDrop={sortable ? drop(task) : undefined}
            dropBefore={over === task.id}
          />
          {children.map((child) => (
            <TaskItem
              key={child.id}
              task={child}
              showProject={false}
              showDate={showDate}
              depth={1}
            />
          ))}
        </Box>
      ))}
      <Box
        className="drop-end"
        data-drop-before={over === 'end' || undefined}
        onDragOver={sortable ? dragOver('end') : undefined}
        onDrop={sortable ? drop(null) : undefined}
      >
        {add !== false && <AddTaskRow defaults={add} />}
      </Box>
    </Box>
  );
}
