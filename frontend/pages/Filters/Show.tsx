import { ActionIcon, Code, Menu } from '@mantine/core';
import { IconDots, IconDroplet, IconTrash } from '@tabler/icons-react';
import { router } from 'nestjs-mvc/react';
import { useEffect } from 'react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { TaskList } from '../../components/TaskList';
import { colorOf } from '../../lib/colors';
import { setPageDefaults } from '../../lib/quickAdd';
import { setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { DetailProps, TaskRow } from '../../types';

interface Props extends DetailProps {
  filter: { id: number; name: string; query: string; color: string };
  tasks: TaskRow[];
}

export default function Show({ filter, tasks }: Props) {
  useEffect(() => setPageDefaults({}), []);
  setTaskOrder(tasks.map((t) => t.id));
  return (
    <>
      <PageHeader
        title={filter.name}
        icon={<IconDroplet size={22} color={colorOf(filter.color)} />}
        description={<Code>{filter.query}</Code>}
        actions={
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Filter actions"
              >
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => router.delete(`/filters/${filter.id}`)}
              >
                Delete filter
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />
      <div data-xray="tasks">
        <TaskList
          tasks={tasks}
          showProject
          empty={
            <EmptyState illustration="done" title="Nothing matches">
              Either you’re on top of things, or the filter is very picky.
            </EmptyState>
          }
        />
      </div>
    </>
  );
}

Show.layout = appLayout;
