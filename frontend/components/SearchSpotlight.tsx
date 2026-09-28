import { Group, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  Spotlight,
  type SpotlightActionData,
  spotlight,
} from '@mantine/spotlight';
import {
  IconCalendarEvent,
  IconChartBar,
  IconCircleCheck,
  IconFilter,
  IconHash,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTag,
} from '@tabler/icons-react';
import { router, useHttp } from 'nestjs-mvc/react';
import { useEffect, useState } from 'react';
import { colorOf } from '../lib/colors';
import { openTask } from '../lib/tasks';
import { openQuickAdd } from '../lib/quickAdd';
import type { LabelRef, SidebarProject, TaskRow } from '../types';
import { PriorityFlag } from './Pickers';

interface Results {
  tasks: TaskRow[];
  projects: SidebarProject[];
  labels: LabelRef[];
  filters: { id: number; name: string; color: string }[];
}

const PAGES: [string, string, typeof IconInbox][] = [
  ['Inbox', '/inbox', IconInbox],
  ['Today', '/today', IconCalendarEvent],
  ['Upcoming', '/upcoming', IconCalendarEvent],
  ['Filters & Labels', '/filters-labels', IconFilter],
  ['Completed', '/completed', IconCircleCheck],
  ['Productivity', '/productivity', IconChartBar],
  ['Settings', '/settings', IconSettings],
];

export const openSearch = () => spotlight.open();

/** Opens a task where it lives, with its dialog on top. */
function goToTask(task: TaskRow) {
  const path = task.project.isInbox ? '/inbox' : `/projects/${task.project.id}`;
  if (window.location.pathname === path) openTask(task.id);
  else router.visit(`${path}?task=${task.id}`);
}

/**
 * Cmd+K, with Mantine's Spotlight. Typing asks GET /search/results with
 * useHttp: a plain JSON request, so the page, its props and the history
 * stay as they are. Choosing a result is an ordinary visit.
 */
export function SearchSpotlight() {
  const [query, setQuery] = useState('');
  const [q] = useDebouncedValue(query.trim(), 150);
  const search = useHttp<{ q: string }, Results>({ q: '' });

  useEffect(() => {
    search.setData('q', q);
  }, [q]);
  useEffect(() => {
    if (!search.data.q) return;
    search.cancel();
    search.get('/search/results').catch(() => {
      // Cancelled by the next keystroke: keep the last results.
    });
  }, [search.data.q]);

  const results = q && search.response ? search.response : null;
  const typed = query.trim().toLowerCase();
  const actions: SpotlightActionData[] = [
    ...(results?.tasks ?? []).map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      description: task.project.isInbox ? 'Inbox' : task.project.name,
      leftSection: <PriorityFlag priority={task.priority} />,
      onClick: () => goToTask(task),
    })),
    ...(results?.projects ?? []).map((p) => ({
      id: `project-${p.id}`,
      label: p.isInbox ? 'Inbox' : p.name,
      description: 'Project',
      leftSection: <IconHash size={18} color={colorOf(p.color)} />,
      onClick: () => router.visit(p.isInbox ? '/inbox' : `/projects/${p.id}`),
    })),
    ...(results?.labels ?? []).map((l) => ({
      id: `label-${l.id}`,
      label: l.name,
      description: 'Label',
      leftSection: <IconTag size={18} color={colorOf(l.color)} />,
      onClick: () => router.visit(`/labels/${l.id}`),
    })),
    ...(results?.filters ?? []).map((f) => ({
      id: `filter-${f.id}`,
      label: f.name,
      description: 'Filter',
      leftSection: <IconFilter size={18} color={colorOf(f.color)} />,
      onClick: () => router.visit(`/filters/${f.id}`),
    })),
    ...[
      {
        id: 'add',
        label: 'Add task',
        description: 'Or press Q anywhere',
        leftSection: <IconPlus size={18} />,
        onClick: () => openQuickAdd(),
        words: 'add new task create q',
      },
      ...PAGES.map(([label, href, Icon]) => ({
        id: href,
        label,
        description: 'Go to',
        leftSection: <Icon size={18} />,
        onClick: () => router.visit(href),
        words: label.toLowerCase(),
      })),
    ]
      .filter((item) => !typed || item.words.includes(typed))
      .map(({ words: _words, ...item }) => item),
  ];

  return (
    <Spotlight
      actions={actions}
      query={query}
      onQueryChange={setQuery}
      // The server already searched; keep its order.
      filter={(_, all) => all}
      shortcut={['mod + K', '/']}
      highlightQuery
      scrollable
      maxHeight={440}
      nothingFound={
        search.processing ? (
          'Searching…'
        ) : (
          <Group justify="center" gap={6}>
            <Text size="sm" c="dimmed">
              Nothing matches “{query.trim()}”.
            </Text>
          </Group>
        )
      }
      searchProps={{
        leftSection: <IconSearch size={18} />,
        placeholder: 'Search tasks, projects, labels, or jump to a page…',
      }}
    />
  );
}
