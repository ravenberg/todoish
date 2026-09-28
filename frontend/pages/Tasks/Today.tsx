import { Anchor, Group, Text } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { router, usePage } from 'nestjs-mvc/react';
import { useEffect } from 'react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { TaskList } from '../../components/TaskList';
import { addDays, dayHeading } from '../../lib/format';
import { setPageDefaults } from '../../lib/quickAdd';
import { setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { DetailProps, SharedProps, TaskRow } from '../../types';

interface Props extends DetailProps {
  tasks: TaskRow[];
}

export default function Today({ tasks }: Props) {
  const { today } = usePage<SharedProps>().props;
  const overdue = tasks.filter((t) => t.dueDate! < today);
  const due = tasks.filter((t) => t.dueDate === today);
  useEffect(() => setPageDefaults({ dueDate: today }), [today]);
  setTaskOrder([...overdue, ...due].map((t) => t.id));

  // One request for all of them; they move down at once.
  const rescheduleAll = () =>
    router
      .optimistic<Props>((props) => ({
        tasks: props.tasks.map((t) =>
          t.dueDate! < today ? { ...t, dueDate: today } : t,
        ),
      }))
      .post(
        '/tasks/reschedule',
        { ids: overdue.map((t) => t.id), dueDate: today },
        {
          only: ['tasks', 'counts'],
          preserveScroll: true,
          preserveState: true,
        },
      );

  return (
    <>
      <PageHeader
        title="Today"
        description={
          tasks.length > 0 && (
            <Group gap={4}>
              <IconCircleCheck size={14} />
              {tasks.filter((t) => !t.parentId).length} tasks
            </Group>
          )
        }
      />
      <div data-xray="tasks">
        {overdue.length > 0 && (
          <>
            <Group justify="space-between" className="section-title">
              <Text fw={700} size="sm">
                Overdue
              </Text>
              <Anchor size="sm" onClick={rescheduleAll}>
                Reschedule
              </Anchor>
            </Group>
            <TaskList tasks={overdue} showProject add={false} />
          </>
        )}
        {overdue.length > 0 && (
          <Text fw={700} size="sm" className="section-title">
            {dayHeading(today, today)}
          </Text>
        )}
        <TaskList
          tasks={due}
          showProject
          showDate={false}
          add={{ dueDate: today }}
          empty={
            overdue.length === 0 && (
              <EmptyState
                illustration="done"
                title="You’re all done for today! #TodoishZero"
              >
                Enjoy the rest of your day. Or peek at{' '}
                <Anchor size="sm" onClick={() => router.visit('/upcoming')}>
                  tomorrow
                </Anchor>{' '}
                (
                {new Date(`${addDays(today, 1)}T12:00`).toLocaleDateString(
                  'en-GB',
                  { weekday: 'long' },
                )}
                ), if you must.
              </EmptyState>
            )
          }
        />
      </div>
    </>
  );
}

Today.layout = appLayout;
