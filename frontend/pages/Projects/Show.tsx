import {
  ActionIcon,
  Anchor,
  Avatar,
  Box,
  Button,
  FileButton,
  Group,
  Menu,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
  IconAdjustmentsHorizontal,
  IconDots,
  IconDownload,
  IconEdit,
  IconHeart,
  IconHeartOff,
  IconLayoutBoard,
  IconLayoutList,
  IconLogout,
  IconPlus,
  IconTrash,
  IconUpload,
  IconUserPlus,
} from '@tabler/icons-react';
import { Link, router, useForm, usePoll, useRemember } from 'nestjs-mvc/react';
import { type FormEvent, useEffect, useMemo } from 'react';
import { Board } from '../../components/Board';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { showProjectForm } from '../../components/ProjectForm';
import { ShareDialog } from '../../components/ShareDialog';
import { TaskList } from '../../components/TaskList';
import { initials } from '../../lib/format';
import { setPageDefaults } from '../../lib/quickAdd';
import { byPosition, nest, setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { DetailProps, Person, TaskRow } from '../../types';

interface Props extends DetailProps {
  project: {
    id: number;
    name: string;
    color: string;
    viewStyle: 'list' | 'board';
    favorite: boolean;
    mine: boolean;
    owner: Person;
  };
  people: Person[];
  sections: { id: number; name: string }[];
  tasks: TaskRow[];
  cursor: string;
  changes: Record<string, TaskRow>;
}

/**
 * Todoist's "View" button: a popover with the layouts as two cards.
 */
function ViewPicker({
  value,
  onChange,
  icon = false,
}: {
  value: 'list' | 'board';
  onChange: (view: string) => void;
  icon?: boolean;
}) {
  const layouts = [
    ['list', 'List', <IconLayoutList key="l" size={22} />],
    ['board', 'Board', <IconLayoutBoard key="b" size={22} />],
  ] as const;
  return (
    <Popover position="bottom-end" width={240} withinPortal>
      <Popover.Target>
        {icon ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            size="lg"
            aria-label="View"
          >
            <IconAdjustmentsHorizontal size={18} />
          </ActionIcon>
        ) : (
          <Button
            variant="subtle"
            color="gray"
            size="compact-md"
            leftSection={<IconAdjustmentsHorizontal size={16} />}
          >
            View
          </Button>
        )}
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="xs" fw={700} c="dimmed" mb={6}>
          Layout
        </Text>
        <SimpleGrid cols={2} spacing={6}>
          {layouts.map(([key, label, glyph]) => (
            <UnstyledButton
              key={key}
              className="layout-card"
              data-active={value === key || undefined}
              onClick={() => onChange(key)}
            >
              <Stack gap={4} align="center">
                {glyph}
                <Text size="xs" fw={600}>
                  {label}
                </Text>
              </Stack>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}

/** The body of the "Rename section" modal. */
function RenameSection({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const form = useForm({ name });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.data.name.trim()) return;
    onSave(form.data.name.trim());
    modals.closeAll();
  }
  return (
    <form onSubmit={submit}>
      <TextInput
        data-autofocus
        value={form.data.name}
        onChange={(e) => form.setData('name', e.currentTarget.value)}
        aria-label="Section name"
      />
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="light" color="gray" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!form.data.name.trim()}>
          Save
        </Button>
      </Group>
    </form>
  );
}

/**
 * The tasks as the page should show them: the list the page loaded, with
 * the poll's `changes` laid over it. A change replaces the task with the
 * same id, adds one the list doesn't have yet, and removes one that was
 * completed or deleted by someone else.
 */
function overlay(tasks: TaskRow[], changes: Record<string, TaskRow>) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const change of Object.values(changes ?? {})) {
    const current = byId.get(change.id);
    if (current && current.updatedAt > change.updatedAt) continue;
    if (change.completedAt || change.deletedAt) byId.delete(change.id);
    else byId.set(change.id, change);
  }
  return [...byId.values()].sort(byPosition);
}

function SectionHeader({
  projectId,
  section,
  count,
}: {
  projectId: number;
  section: { id: number | null; name: string };
  count: number;
}) {
  return (
    <Group justify="space-between" className="section-title" wrap="nowrap">
      <Group gap={6}>
        <Text fw={700} size="sm">
          {section.name}
        </Text>
        <Text size="xs" c="dimmed">
          {count}
        </Text>
      </Group>
      {section.id !== null && (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Section actions"
            >
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconEdit size={16} />}
              onClick={() =>
                modals.open({
                  title: 'Rename section',
                  children: (
                    <RenameSection
                      name={section.name}
                      onSave={(name) =>
                        router.patch(
                          `/projects/${projectId}/sections/${section.id}`,
                          { name },
                          {
                            only: ['sections'],
                            preserveScroll: true,
                            preserveState: true,
                          },
                        )
                      }
                    />
                  ),
                })
              }
            >
              Rename
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() =>
                router.delete(`/projects/${projectId}/sections/${section.id}`, {
                  only: ['sections', 'tasks'],
                  preserveScroll: true,
                  preserveState: true,
                })
              }
            >
              Delete section (keeps its tasks)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

function AddSection({ projectId }: { projectId: number }) {
  const [adding, setAdding] = useRemember(false, `add-section-${projectId}`);
  const form = useForm({ name: '' });
  function submit(event: FormEvent) {
    event.preventDefault();
    form.post(`/projects/${projectId}/sections`, {
      only: ['sections'],
      errorBag: 'section',
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        form.reset();
        setAdding(false);
      },
    });
  }
  if (!adding)
    return (
      <Button
        variant="subtle"
        color="gray"
        fw={400}
        leftSection={<IconPlus size={14} />}
        onClick={() => setAdding(true)}
        mt="md"
      >
        Add section
      </Button>
    );
  return (
    <form onSubmit={submit}>
      <Group mt="md" gap="xs" align="flex-start">
        <TextInput
          data-autofocus
          autoFocus
          placeholder="Name this section"
          value={form.data.name}
          onChange={(e) => form.setData('name', e.currentTarget.value)}
          error={form.errors.name}
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={form.processing}>
          Add
        </Button>
        <Button variant="default" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </Group>
    </form>
  );
}

export default function Show({
  project,
  people,
  sections,
  tasks,
  cursor,
  changes,
}: Props) {
  const shared = people.length > 1;
  const [shareOpened, share] = useDisclosure(false);
  const shown = useMemo(() => overlay(tasks, changes), [tasks, changes]);
  const columns = [
    ...(shown.some((t) => !t.sectionId) || sections.length === 0
      ? [{ id: null, name: sections.length ? '(No section)' : 'Tasks' }]
      : []),
    ...sections,
  ];

  useEffect(() => setPageDefaults({ projectId: project.id }), [project.id]);
  setTaskOrder(
    columns.flatMap((c) =>
      nest(shown.filter((t) => t.sectionId === c.id)).flatMap((row) => [
        row.task.id,
        ...row.children.map((child) => child.id),
      ]),
    ),
  );

  // In a shared project, other people's changes arrive every few seconds:
  // a partial reload of just `changes` and `cursor`, with the cursor in a
  // header so the server sends only what's new.
  const poll = usePoll(
    4000,
    () => ({
      only: ['changes', 'cursor'],
      headers: { 'X-Project-Since': cursor },
    }),
    { autoStart: false },
  );
  useEffect(() => {
    if (shared) poll.start();
    return () => poll.stop();
  }, [shared]);

  const setView = (viewStyle: string) =>
    router
      .optimistic<Props>((props) => ({
        project: { ...props.project, viewStyle: viewStyle as 'list' | 'board' },
      }))
      .patch(
        `/projects/${project.id}`,
        { viewStyle },
        { only: ['project'], preserveScroll: true, preserveState: true },
      );

  return (
    <Box data-wide={project.viewStyle === 'board' || undefined}>
      <Anchor
        component={Link}
        href="/projects"
        size="xs"
        c="dimmed"
        visibleFrom="sm"
        mt={-16}
        mb={8}
        display="block"
      >
        My Projects /
      </Anchor>
      <PageHeader
        title={project.name}
        description={shared ? `Shared by ${project.owner.name}` : undefined}
        actions={
          <Group gap={4} wrap="nowrap">
            {shared && (
              <Avatar.Group mr={4}>
                {people.slice(0, 4).map((p) => (
                  <Tooltip key={p.id} label={p.name}>
                    <Avatar
                      size={28}
                      radius="xl"
                      color="initials"
                      name={p.name}
                    >
                      {initials(p.name)}
                    </Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            )}
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconUserPlus size={16} />}
              onClick={share.open}
              size="compact-md"
            >
              Share
            </Button>
            <ViewPicker value={project.viewStyle} onChange={setView} />
          </Group>
        }
        phoneActions={
          <>
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="xl"
              size="lg"
              onClick={share.open}
              aria-label="Share"
            >
              <IconUserPlus size={18} />
            </ActionIcon>
            <ViewPicker value={project.viewStyle} onChange={setView} icon />
          </>
        }
        menu={
          <>
            <Menu.Item
              leftSection={<IconEdit size={16} />}
              onClick={() => showProjectForm({ ...project })}
              disabled={!project.mine}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              leftSection={
                project.favorite ? (
                  <IconHeartOff size={16} />
                ) : (
                  <IconHeart size={16} />
                )
              }
              onClick={() =>
                router.patch(
                  `/projects/${project.id}`,
                  { favorite: !project.favorite },
                  { preserveScroll: true },
                )
              }
            >
              {project.favorite ? 'Remove from favorites' : 'Add to favorites'}
            </Menu.Item>

            <Menu.Divider />
            {/* A normal link: the server answers with location(), so the browser downloads. */}
            <Menu.Item
              component={Link}
              href={`/projects/${project.id}/export`}
              leftSection={<IconDownload size={16} />}
            >
              Export as CSV
            </Menu.Item>
            <FileButton
              accept=".csv,text/csv"
              onChange={(file) =>
                file &&
                router.post(
                  `/projects/${project.id}/import`,
                  { file },
                  {
                    forceFormData: true,
                    preserveScroll: true,
                    errorBag: 'import',
                  },
                )
              }
            >
              {(props) => (
                <Menu.Item
                  {...props}
                  leftSection={<IconUpload size={16} />}
                  closeMenuOnClick={false}
                >
                  Import from CSV
                </Menu.Item>
              )}
            </FileButton>
            <Menu.Divider />
            {project.mine ? (
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() =>
                  modals.openConfirmModal({
                    title: `Delete “${project.name}”?`,
                    children: (
                      <Text size="sm">
                        All its tasks go with it. There's no undo, not even an
                        ish one.
                      </Text>
                    ),
                    confirmProps: { color: 'red' },
                    onConfirm: () => router.delete(`/projects/${project.id}`),
                  })
                }
              >
                Delete project
              </Menu.Item>
            ) : (
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={() => router.post(`/projects/${project.id}/leave`)}
              >
                Leave project
              </Menu.Item>
            )}
          </>
        }
      />

      {shown.length === 0 && sections.length === 0 && (
        <EmptyState
          illustration="coffee-break"
          title="Start small (or dream big)"
        >
          Add a task, or a section to sort them into. Press Q anywhere.
        </EmptyState>
      )}

      {project.viewStyle === 'board' ? (
        <Board
          projectId={project.id}
          columns={columns}
          tasks={shown}
          header={(column, count) => (
            <SectionHeader
              projectId={project.id}
              section={column}
              count={count}
            />
          )}
        />
      ) : (
        <div data-xray="tasks">
          {columns.map((column) => (
            <Box key={column.id ?? 'none'} mb="md">
              {(column.id !== null || sections.length > 0) && (
                <SectionHeader
                  projectId={project.id}
                  section={column}
                  count={
                    shown.filter(
                      (t) => t.sectionId === column.id && !t.parentId,
                    ).length
                  }
                />
              )}
              <TaskList
                tasks={shown.filter((t) => t.sectionId === column.id)}
                allTasks={shown}
                sectionId={column.id}
                add={{ projectId: project.id, sectionId: column.id }}
              />
            </Box>
          ))}
        </div>
      )}
      <AddSection projectId={project.id} />
      <ShareDialog
        projectId={project.id}
        mine={project.mine}
        opened={shareOpened}
        onClose={share.close}
      />
    </Box>
  );
}

Show.layout = appLayout;
