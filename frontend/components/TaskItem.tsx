import { ActionIcon, Box, Group, Menu, Text } from '@mantine/core';
import {
  IconArrowRight,
  IconCalendarEvent,
  IconDots,
  IconFlag,
  IconTrash,
} from '@tabler/icons-react';
import { usePage } from 'nestjs-mvc/react';
import type { DragEvent } from 'react';
import { PRIORITY_COLOR } from '../lib/colors';
import { addDays } from '../lib/format';
import { completeTask, deleteTask, openTask, updateTask } from '../lib/tasks';
import type { SharedProps, TaskRow } from '../types';
import { TaskCheckbox } from './TaskCheckbox';
import { ProjectTag, TaskMeta } from './TaskMeta';

export const TASK_MIME = 'application/x-todoish-task';

/**
 * One task in a list. Clicking it opens the task dialog; the circle
 * completes it. On a big screen, a menu shows on hover for the usual
 * quick changes; on a phone, the dialog does everything.
 */
export function TaskItem({
  task,
  showProject = false,
  showDate = true,
  depth = 0,
  draggable = false,
  onDragOver,
  onDrop,
  dropBefore = false,
}: {
  task: TaskRow;
  showProject?: boolean;
  showDate?: boolean;
  depth?: number;
  draggable?: boolean;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  dropBefore?: boolean;
}) {
  const { props } = usePage<SharedProps>();
  const today = props.today;

  return (
    <Box
      className="task-item"
      data-drop-before={dropBefore || undefined}
      pl={depth * 28}
      draggable={draggable}
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData(TASK_MIME, String(task.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => openTask(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') openTask(task.id);
      }}
    >
      <Group align="flex-start" gap={10} wrap="nowrap" py={9}>
        <Box pt={1}>
          <TaskCheckbox
            priority={task.priority}
            onCheck={() => completeTask(task)}
          />
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group
            justify="space-between"
            gap="xs"
            wrap="nowrap"
            align="flex-start"
          >
            <Text size="sm" lh={1.45} style={{ wordBreak: 'break-word' }}>
              {task.title}
            </Text>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  className="task-item-menu"
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="More actions"
                  onClick={(event) => event.stopPropagation()}
                  visibleFrom="sm"
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                <Menu.Label>Due date</Menu.Label>
                <Menu.Item
                  leftSection={<IconCalendarEvent size={16} color="#058527" />}
                  onClick={() => updateTask(task, { dueDate: today })}
                >
                  Today
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconArrowRight size={16} color="#ad6200" />}
                  onClick={() =>
                    updateTask(task, { dueDate: addDays(today, 1) })
                  }
                >
                  Tomorrow
                </Menu.Item>
                <Menu.Label>Priority</Menu.Label>
                <Group gap={2} px="xs" pb={6}>
                  {[1, 2, 3, 4].map((p) => (
                    <ActionIcon
                      key={p}
                      variant={task.priority === p ? 'light' : 'subtle'}
                      color="gray"
                      aria-label={`Priority ${p}`}
                      onClick={() =>
                        updateTask(task, { priority: p as TaskRow['priority'] })
                      }
                    >
                      <IconFlag
                        size={16}
                        color={PRIORITY_COLOR[p]}
                        fill={p < 4 ? PRIORITY_COLOR[p] : 'none'}
                      />
                    </ActionIcon>
                  ))}
                </Group>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => deleteTask(task)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          {task.description && (
            <Text size="xs" c="dimmed" lineClamp={1} mt={1}>
              {task.description}
            </Text>
          )}
          <Group
            justify="space-between"
            gap="xs"
            wrap="nowrap"
            align="flex-end"
          >
            <TaskMeta task={task} today={today} showDate={showDate} />
            {showProject && <ProjectTag project={task.project} />}
          </Group>
        </Box>
      </Group>
    </Box>
  );
}
