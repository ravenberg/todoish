import { Box, Group, Stack, Text } from '@mantine/core';
import { usePage } from 'nestjs-mvc/react';
import { type DragEvent, type ReactNode, useState } from 'react';
import { completeTask, moveTask, openTask } from '../lib/tasks';
import type { SharedProps, TaskRow } from '../types';
import { TASK_MIME } from './TaskItem';
import { TaskCheckbox } from './TaskCheckbox';
import { TaskMeta } from './TaskMeta';
import { AddTaskRow } from './TaskList';

function Card({
  task,
  dropBefore,
  onDragOver,
  onDrop,
}: {
  task: TaskRow;
  dropBefore: boolean;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  const today = usePage<SharedProps>().props.today;
  return (
    <Box
      className="board-card task-item"
      data-drop-before={dropBefore || undefined}
      draggable
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData(TASK_MIME, String(task.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => openTask(task.id)}
      p="sm"
    >
      <Group align="flex-start" gap={8} wrap="nowrap">
        <Box pt={1}>
          <TaskCheckbox
            priority={task.priority}
            size={18}
            onCheck={() => completeTask(task)}
          />
        </Box>
        <Box style={{ minWidth: 0 }}>
          <Text size="sm">{task.title}</Text>
          {task.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {task.description}
            </Text>
          )}
          <TaskMeta task={task} today={today} />
        </Box>
      </Group>
    </Box>
  );
}

/**
 * A project as columns, one per section. Drag a card to another column or
 * between two cards: it moves at once (optimistic), and the server's
 * answer confirms it, or puts it back.
 */
export function Board({
  projectId,
  columns,
  tasks,
  header,
}: {
  projectId: number;
  columns: { id: number | null; name: string }[];
  tasks: TaskRow[];
  header: (
    column: { id: number | null; name: string },
    count: number,
  ) => ReactNode;
}) {
  const [over, setOver] = useState<{
    column: number | null;
    before: number | null;
  } | null>(null);
  const roots = tasks.filter((t) => !t.parentId);

  const drop =
    (column: number | null, before: TaskRow | null) => (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setOver(null);
      const task = tasks.find(
        (t) => t.id === Number(event.dataTransfer.getData(TASK_MIME)),
      );
      if (!task || task.id === before?.id) return;
      moveTask(task, { sectionId: column, before });
    };
  const dragOver =
    (column: number | null, before: number | null) => (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(TASK_MIME)) return;
      event.preventDefault();
      event.stopPropagation();
      setOver({ column, before });
    };

  return (
    <div className="board" data-xray="tasks">
      {columns.map((column) => {
        const cards = roots.filter((t) => t.sectionId === column.id);
        return (
          <Box
            key={column.id ?? 'none'}
            className="board-column"
            data-over={over?.column === column.id || undefined}
            onDragOver={dragOver(column.id, null)}
            onDrop={drop(column.id, null)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setOver(null);
            }}
          >
            {header(column, cards.length)}
            <Stack gap={8} mt="xs">
              {cards.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  dropBefore={
                    over?.column === column.id && over.before === task.id
                  }
                  onDragOver={dragOver(column.id, task.id)}
                  onDrop={drop(column.id, task)}
                />
              ))}
            </Stack>
            <AddTaskRow defaults={{ projectId, sectionId: column.id }} />
          </Box>
        );
      })}
    </div>
  );
}
