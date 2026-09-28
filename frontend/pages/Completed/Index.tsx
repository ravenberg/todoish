import { Avatar, Box, Group, Loader, Select, Stack, Text } from '@mantine/core';
import {
  IconCircleCheckFilled,
  IconMessage,
  IconPlus,
  IconRotate,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';
import { WhenVisible, router, usePage } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { ProjectTag } from '../../components/TaskMeta';
import { clock, dayHeading, initials, toDay } from '../../lib/format';
import { appLayout } from '../../layouts/AppLayout';
import type { ProjectRef, SharedProps } from '../../types';

interface Entry {
  id: number;
  kind: 'added' | 'completed' | 'reopened' | 'commented' | 'deleted' | 'joined';
  actor: { id: number; name: string };
  you: boolean;
  project: ProjectRef;
  taskId: number | null;
  taskTitle: string;
  priority: number;
  at: string;
}

interface Props {
  filters: { project: number | null; kind: 'all' | 'completed' };
  activity: Entry[];
  older: number | null;
}

const VERB: Record<Entry['kind'], [string, ReactNode]> = {
  completed: [
    'completed a task',
    <IconCircleCheckFilled size={14} color="#058527" />,
  ],
  added: ['added a task', <IconPlus size={14} color="#246fe0" />],
  reopened: ['reopened a task', <IconRotate size={14} color="#eb8909" />],
  commented: ['commented on', <IconMessage size={14} color="#692ec2" />],
  deleted: ['deleted a task', <IconTrash size={14} color="#d1453b" />],
  joined: ['joined the project', <IconUserPlus size={14} color="#058527" />],
};

/**
 * Completed, and the rest of what happened. The first 30 come with the page;
 * when the end of the list scrolls into view, WhenVisible asks for the next
 * 30 (`before` the last one) and `merge()` adds them below. A filter starts
 * the list over: `reset`.
 */
export default function Index({ filters, activity, older }: Props) {
  const { props } = usePage<SharedProps>();
  const projects = props.sidebar?.projects ?? [];
  const today = props.today;

  const filter = (patch: Partial<Props['filters']>) => {
    const next = { ...filters, ...patch };
    router.get(
      '/completed',
      {
        ...(next.project ? { project: next.project } : {}),
        ...(next.kind === 'all' ? { kind: 'all' } : {}),
      },
      {
        only: ['activity', 'older', 'filters'],
        reset: ['activity'],
        preserveState: true,
      },
    );
  };

  let lastDay = '';
  return (
    <>
      <PageHeader title={filters.kind === 'all' ? 'Activity' : 'Completed'} />
      <Group mb="md" gap="xs">
        <Select
          size="xs"
          w={200}
          value={filters.project ? String(filters.project) : 'all'}
          allowDeselect={false}
          data={[
            { value: 'all', label: 'All projects' },
            ...projects.map((p) => ({
              value: String(p.id),
              label: p.isInbox ? 'Inbox' : p.name,
            })),
          ]}
          onChange={(value) =>
            filter({ project: value === 'all' ? null : Number(value) })
          }
        />
        <Select
          size="xs"
          w={170}
          value={filters.kind}
          allowDeselect={false}
          data={[
            { value: 'completed', label: 'Completed tasks' },
            { value: 'all', label: 'All events' },
          ]}
          onChange={(value) => filter({ kind: value as 'all' | 'completed' })}
        />
      </Group>

      {activity.length === 0 && (
        <EmptyState illustration="the-void" title="Nothing yet">
          Complete a task and it shows up here, with a small sense of
          achievement.
        </EmptyState>
      )}

      <Stack gap={0} data-xray="activity">
        {activity.map((entry) => {
          const day = toDay(new Date(entry.at));
          const heading = day !== lastDay;
          lastDay = day;
          const [verb, icon] = VERB[entry.kind];
          return (
            <Box key={entry.id}>
              {heading && (
                <Text fw={700} size="sm" className="section-title">
                  {dayHeading(day, today)}
                </Text>
              )}
              <Group
                gap="sm"
                py={10}
                wrap="nowrap"
                align="flex-start"
                style={{ borderBottom: '1px solid var(--todo-line)' }}
              >
                <Box pos="relative">
                  <Avatar
                    size={30}
                    radius="xl"
                    color="initials"
                    name={entry.actor.name}
                  >
                    {initials(entry.actor.name)}
                  </Avatar>
                  <Box
                    pos="absolute"
                    bottom={-4}
                    right={-4}
                    bg="var(--mantine-color-body)"
                    style={{ borderRadius: 99, lineHeight: 0, padding: 1 }}
                  >
                    {icon}
                  </Box>
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm">
                    <b>{entry.you ? 'You' : entry.actor.name.split(' ')[0]}</b>{' '}
                    {verb}
                    {entry.kind !== 'joined' && ':'}
                  </Text>
                  {entry.taskTitle && (
                    <Text size="sm" c="dimmed" truncate>
                      {entry.taskTitle}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {clock(entry.at)}
                  </Text>
                </Box>
                <ProjectTag project={entry.project} />
              </Group>
            </Box>
          );
        })}
      </Stack>

      {older && (
        <WhenVisible
          key={older}
          data={['activity', 'older']}
          // The props are already there (the first page), so without
          // `always` it would think it has nothing to load.
          always
          buffer={400}
          params={{ data: { before: older }, preserveUrl: true }}
          fallback={
            <Group justify="center" p="md">
              <Loader size="sm" />
            </Group>
          }
        >
          <Group justify="center" p="md">
            <Loader size="sm" />
          </Group>
        </WhenVisible>
      )}
    </>
  );
}

Index.layout = appLayout;
