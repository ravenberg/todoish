import { Group, Loader, NavLink, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconDroplet,
  IconHash,
  IconSearch,
  IconTag,
} from '@tabler/icons-react';
import { Head, Link, useHttp } from 'nestjs-mvc/react';
import { useEffect } from 'react';
import { TaskList } from '../../components/TaskList';
import { colorOf } from '../../lib/colors';
import { setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { LabelRef, SidebarProject, TaskRow } from '../../types';

interface Results {
  tasks: TaskRow[];
  projects: SidebarProject[];
  labels: LabelRef[];
  filters: { id: number; name: string; color: string }[];
}

/**
 * The search tab on a phone. Same endpoint as Cmd+K on a big screen: each
 * pause in typing is a useHttp request for JSON, and the page stays put.
 */
export default function Search() {
  const search = useHttp<{ q: string }, Results>({ q: '' });
  const [q] = useDebouncedValue(search.data.q.trim(), 200);

  useEffect(() => {
    if (!q) return;
    search.cancel();
    search.get('/search/results').catch(() => {
      // Cancelled by the next keystroke.
    });
  }, [q]);

  const results = q ? search.response : null;
  setTaskOrder(results?.tasks.map((t) => t.id) ?? []);
  const empty =
    results &&
    !results.tasks.length &&
    !results.projects.length &&
    !results.labels.length &&
    !results.filters.length;

  return (
    <>
      <Head title="Search · Todoish" />
      <TextInput
        size="md"
        radius="xl"
        autoFocus
        placeholder="Tasks, projects, labels…"
        leftSection={<IconSearch size={18} />}
        rightSection={search.processing ? <Loader size="xs" /> : null}
        value={search.data.q}
        onChange={(e) => search.setData('q', e.currentTarget.value)}
        mb="md"
      />
      {empty && (
        <Text c="dimmed" ta="center" py="xl">
          Nothing matches “{q}”.
        </Text>
      )}
      {results && (
        <Stack gap="lg">
          {results.tasks.length > 0 && (
            <div>
              <Text fw={700} size="sm" mb={4}>
                Tasks
              </Text>
              <TaskList tasks={results.tasks} showProject add={false} />
            </div>
          )}
          {results.projects.length +
            results.labels.length +
            results.filters.length >
            0 && (
            <div>
              <Text fw={700} size="sm" mb={4}>
                Places
              </Text>
              {results.projects.map((p) => (
                <NavLink
                  key={`p${p.id}`}
                  component={Link}
                  href={p.isInbox ? '/inbox' : `/projects/${p.id}`}
                  label={p.isInbox ? 'Inbox' : p.name}
                  leftSection={<IconHash size={18} color={colorOf(p.color)} />}
                />
              ))}
              {results.labels.map((l) => (
                <NavLink
                  key={`l${l.id}`}
                  component={Link}
                  href={`/labels/${l.id}`}
                  label={l.name}
                  leftSection={<IconTag size={18} color={colorOf(l.color)} />}
                />
              ))}
              {results.filters.map((f) => (
                <NavLink
                  key={`f${f.id}`}
                  component={Link}
                  href={`/filters/${f.id}`}
                  label={f.name}
                  leftSection={
                    <IconDroplet size={18} color={colorOf(f.color)} />
                  }
                />
              ))}
            </div>
          )}
        </Stack>
      )}
      {!q && (
        <Group justify="center" c="dimmed" py="xl">
          <Text size="sm">Try “report”, “#Home” or “@errands”.</Text>
        </Group>
      )}
    </>
  );
}

Search.layout = appLayout;
