import {
  ActionIcon,
  Avatar,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconChartBar,
  IconCircleCheck,
  IconFilter,
  IconHash,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { Head, Link, usePage } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { showProjectForm } from '../components/ProjectForm';
import { colorOf } from '../lib/colors';
import { initials } from '../lib/format';
import { appLayout } from '../layouts/AppLayout';
import type { SharedProps } from '../types';

function Row({
  href,
  icon,
  label,
  right,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  right?: ReactNode;
}) {
  return (
    <NavLink
      component={Link}
      href={href}
      prefetch
      label={label}
      leftSection={icon}
      rightSection={right}
      py={10}
    />
  );
}

/** The Browse tab on a phone: what the sidebar has on a big screen. */
export default function Browse() {
  const { props } = usePage<SharedProps>();
  const user = props.auth.user!;
  const projects = props.sidebar?.projects.filter((p) => !p.isInbox) ?? [];
  return (
    <>
      <Head title="Browse · Todoish" />
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Avatar color="tomato" radius="xl">
            {initials(user.name)}
          </Avatar>
          <Text fw={700}>{user.name.split(' ')[0]}</Text>
        </Group>
        <ActionIcon
          component={Link}
          href="/settings"
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Settings"
        >
          <IconSettings size={20} />
        </ActionIcon>
      </Group>

      <Paper radius="lg" withBorder mb="md">
        <Row href="/search" icon={<IconSearch size={18} />} label="Search" />
        <Row
          href="/inbox"
          icon={<IconInbox size={18} />}
          label="Inbox"
          right={
            <Text size="xs" c="dimmed">
              {props.counts?.inbox || ''}
            </Text>
          }
        />
        <Row
          href="/filters-labels"
          icon={<IconFilter size={18} />}
          label="Filters & Labels"
        />
        <Row
          href="/completed"
          icon={<IconCircleCheck size={18} />}
          label="Completed"
        />
        <Row
          href="/productivity"
          icon={<IconChartBar size={18} />}
          label="Productivity"
        />
      </Paper>

      <Group justify="space-between" px={4} mb={4}>
        <Text
          component={Link}
          href="/projects"
          fw={700}
          c="var(--mantine-color-text)"
          td="none"
        >
          My Projects
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={() => showProjectForm()}
          aria-label="Add project"
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>
      <Paper radius="lg" withBorder>
        <Stack gap={0}>
          {projects.map((p) => (
            <Row
              key={p.id}
              href={`/projects/${p.id}`}
              icon={<IconHash size={18} color={colorOf(p.color)} />}
              label={p.name}
              right={
                <Group gap={6}>
                  {p.shared && (
                    <IconUsers size={14} color="var(--mantine-color-dimmed)" />
                  )}
                  <Text size="xs" c="dimmed">
                    {props.counts?.projects[p.id] || ''}
                  </Text>
                </Group>
              }
            />
          ))}
        </Stack>
      </Paper>
    </>
  );
}

Browse.layout = appLayout;
