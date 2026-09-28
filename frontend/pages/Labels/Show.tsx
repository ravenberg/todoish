import { IconTag } from '@tabler/icons-react';
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
  label: { id: number; name: string; color: string };
  tasks: TaskRow[];
}

export default function Show({ label, tasks }: Props) {
  useEffect(() => setPageDefaults({}), []);
  setTaskOrder(tasks.map((t) => t.id));
  return (
    <>
      <PageHeader
        title={label.name}
        icon={<IconTag size={22} color={colorOf(label.color)} />}
      />
      <div data-xray="tasks">
        <TaskList
          tasks={tasks}
          showProject
          add={false}
          empty={
            <EmptyState
              illustration="the-void"
              title={`Nothing tagged @${label.name}`}
            >
              Type @{label.name} in quick add to put it on a task.
            </EmptyState>
          }
        />
      </div>
    </>
  );
}

Show.layout = appLayout;
