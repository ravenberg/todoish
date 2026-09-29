import { ActionIcon, Avatar, Box, Group, NavLink, Text } from '@mantine/core';
import {
  IconCategory,
  IconChartBar,
  IconChevronRight,
  IconCircleCheck,
  IconHash,
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
    />
  );
}

/** The Browse tab on a phone: what the sidebar has on a big screen. */
export default function Browse() {
  const { props } = usePage<SharedProps>();
  const user = props.auth.user!;
  const projects = props.sidebar?.projects.filter((p) => !p.isInbox) ?? [];
  return (
    <Box data-grouped>
      <Head title="Browse · Todoish" />
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Avatar color="tomato" radius="xl" size={34}>
            {initials(user.name)}
          </Avatar>
          <Text fw={700}>{user.name.split(' ')[0]}</Text>
        </Group>
        <div className="phone-actions">
          <ActionIcon
            component={Link}
            href="/settings"
            variant="subtle"
            color="gray"
            radius="xl"
            size="lg"
            aria-label="Settings"
          >
            <IconSettings size={20} />
          </ActionIcon>
        </div>
      </Group>

      <div className="group-card">
        <Row
          href="/search"
          icon={<IconSearch size={20} className="group-icon" />}
          label="Search"
        />
        <Row
          href="/filters-labels"
          icon={<IconCategory size={20} className="group-icon" />}
          label="Filters & Labels"
        />
        <Row
          href="/completed"
          icon={<IconCircleCheck size={20} className="group-icon" />}
          label="Completed"
        />
        <Row
          href="/productivity"
          icon={<IconChartBar size={20} className="group-icon" />}
          label="Productivity"
        />
      </div>

      <Group justify="space-between" px={4} mt="lg" mb={6}>
        <Link href="/projects" className="plain-link">
          <Group gap={2}>
            <Text fw={700}>My Projects</Text>
            <IconChevronRight size={16} />
          </Group>
        </Link>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={() => showProjectForm()}
          aria-label="Add project"
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>
      <div className="group-card">
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
      </div>
    </Box>
  );
}

Browse.layout = appLayout;
