import { Group, Text } from '@mantine/core';
import {
  IconCalendarEvent,
  IconHash,
  IconInbox,
  IconMessage,
  IconRepeat,
  IconSubtask,
  IconTag,
} from '@tabler/icons-react';
import { colorOf } from '../lib/colors';
import { dueColor, dueLabel, initials } from '../lib/format';
import type { TaskRow } from '../types';

/** The line under a task's title: sub-tasks, date, comments, labels. */
export function TaskMeta({
  task,
  today,
  showDate = true,
}: {
  task: TaskRow;
  today: string;
  showDate?: boolean;
}) {
  const items = [];
  if (task.subtasks && task.subtasks.total > 0)
    items.push(
      <Group key="sub" gap={3} wrap="nowrap" c="dimmed">
        <IconSubtask size={13} />
        <Text size="xs">
          {task.subtasks.done}/{task.subtasks.total}
        </Text>
      </Group>,
    );
  if (showDate && task.dueDate)
    items.push(
      <Group key="due" gap={3} wrap="nowrap" c={dueColor(task.dueDate, today)}>
        <IconCalendarEvent size={13} />
        <Text size="xs" c="inherit">
          {dueLabel(task.dueDate, today)}
          {task.dueTime && ` ${task.dueTime}`}
        </Text>
        {task.recurrence && <IconRepeat size={12} />}
      </Group>,
    );
  else if (!showDate && task.dueTime)
    items.push(
      <Text key="time" size="xs" c={dueColor(task.dueDate ?? today, today)}>
        {task.dueTime}
      </Text>,
    );
  if (!showDate && task.recurrence)
    items.push(
      <IconRepeat key="rec" size={12} color="var(--mantine-color-dimmed)" />,
    );
  if (task.comments > 0)
    items.push(
      <Group key="com" gap={3} wrap="nowrap" c="dimmed">
        <IconMessage size={13} />
        <Text size="xs">{task.comments}</Text>
      </Group>,
    );
  for (const label of task.labels)
    items.push(
      <Group
        key={`l${label.id}`}
        gap={2}
        wrap="nowrap"
        c={colorOf(label.color)}
      >
        <IconTag size={12} />
        <Text size="xs" c="dimmed">
          {label.name}
        </Text>
      </Group>,
    );
  if (task.assignee)
    items.push(
      <span key="who" className="mini-avatar" title={task.assignee.name}>
        {initials(task.assignee.name)}
      </span>,
    );
  if (!items.length) return null;
  return (
    <Group gap={10} mt={2} wrap="wrap">
      {items}
    </Group>
  );
}

/** "Inbox" or "# Work", at the end of a row in lists that mix projects. */
export function ProjectTag({ project }: { project: TaskRow['project'] }) {
  return (
    <Group gap={3} wrap="nowrap" c="dimmed" style={{ flex: 'none' }}>
      <Text size="xs" c="dimmed" truncate maw={140}>
        {project.isInbox ? 'Inbox' : project.name}
      </Text>
      {project.isInbox ? (
        <IconInbox size={13} />
      ) : (
        <IconHash size={13} color={colorOf(project.color)} />
      )}
    </Group>
  );
}
