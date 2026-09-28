import { Button, Group, NavLink, Paper, Text } from '@mantine/core';
import { IconHash, IconPlus, IconUsers } from '@tabler/icons-react';
import { Link } from 'nestjs-mvc/react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { showProjectForm } from '../../components/ProjectForm';
import { colorOf } from '../../lib/colors';
import { appLayout } from '../../layouts/AppLayout';
import type { SidebarProject } from '../../types';

interface Props {
  projects: (SidebarProject & { open: number; people: number })[];
}

export default function Index({ projects }: Props) {
  return (
    <>
      <PageHeader
        title="My Projects"
        actions={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => showProjectForm()}
            size="compact-md"
          >
            Add project
          </Button>
        }
      />
      <Text size="sm" c="dimmed" mb="sm">
        {projects.length} project{projects.length === 1 ? '' : 's'}
      </Text>
      {projects.length === 0 ? (
        <EmptyState illustration="coffee-break" title="No projects yet">
          Projects keep related tasks together. Work, home, that novel.
        </EmptyState>
      ) : (
        <Paper withBorder radius="md">
          {projects.map((p) => (
            <NavLink
              key={p.id}
              component={Link}
              href={`/projects/${p.id}`}
              prefetch
              py={12}
              label={p.name}
              description={p.mine ? undefined : 'Shared with you'}
              leftSection={<IconHash size={18} color={colorOf(p.color)} />}
              rightSection={
                <Group gap="md" wrap="nowrap">
                  {p.people > 1 && (
                    <Group gap={4} c="dimmed">
                      <IconUsers size={14} />
                      <Text size="xs">{p.people}</Text>
                    </Group>
                  )}
                  <Text size="xs" c="dimmed" w={60} ta="right">
                    {p.open} open
                  </Text>
                </Group>
              }
            />
          ))}
        </Paper>
      )}
    </>
  );
}

Index.layout = appLayout;
