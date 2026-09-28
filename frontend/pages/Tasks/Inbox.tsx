import { useEffect } from 'react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { TaskList } from '../../components/TaskList';
import { setPageDefaults } from '../../lib/quickAdd';
import { byPosition, nest, setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { DetailProps, TaskRow } from '../../types';

interface Props extends DetailProps {
  project: { id: number; name: string };
  tasks: TaskRow[];
}

export default function Inbox({ project, tasks }: Props) {
  const sorted = [...tasks].sort(byPosition);
  useEffect(() => setPageDefaults({ projectId: project.id }), [project.id]);
  setTaskOrder(
    nest(sorted).flatMap((row) => [
      row.task.id,
      ...row.children.map((c) => c.id),
    ]),
  );
  return (
    <>
      <PageHeader title="Inbox" />
      <div data-xray="tasks">
        <TaskList
          tasks={sorted}
          sectionId={null}
          add={{ projectId: project.id }}
          empty={
            <EmptyState illustration="the-void" title="Capture now, plan later">
              Your Inbox is where things land before they have a home. It’s
              empty, which is either very organised or very suspicious.
            </EmptyState>
          }
        />
      </div>
    </>
  );
}

Inbox.layout = appLayout;
