import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  FileButton,
  Group,
  Image,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconCalendarEvent,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconDots,
  IconFile,
  IconHash,
  IconInbox,
  IconPaperclip,
  IconPlus,
  IconRepeat,
  IconTag,
  IconTrash,
  IconUpload,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { Link, router, useForm, usePage, usePoll } from 'nestjs-mvc/react';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { colorOf } from '../lib/colors';
import {
  clock,
  dueColor,
  dueLabel,
  fileSize,
  initials,
  relative,
} from '../lib/format';
import { openQuickAdd } from '../lib/quickAdd';
import {
  closeTask,
  completeTask,
  deleteTask,
  neighbours,
  openTask,
  reloadAfterTaskChange,
  reopenTask,
  updateTask,
} from '../lib/tasks';
import type {
  CommentRow,
  DetailProps,
  SharedProps,
  TaskDetail,
} from '../types';
import {
  DuePicker,
  LabelsPicker,
  PriorityFlag,
  PriorityPicker,
  ProjectIcon,
  ProjectPicker,
} from './Pickers';
import { TaskCheckbox } from './TaskCheckbox';
import { TaskMeta } from './TaskMeta';

const ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/pdf',
  'application/json',
  'application/zip',
];

/** Title and description, saved when you leave the field or press Enter. */
function TitleForm({ task }: { task: TaskDetail }) {
  const form = useForm({ title: task.title, description: task.description });
  useEffect(() => {
    form.setDefaults({ title: task.title, description: task.description });
    form.reset();
  }, [task.id, task.title, task.description]);

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!form.isDirty) return;
    // Its own error bag: a mistake here never shows up in the comment box.
    form.patch(`/tasks/${task.id}`, {
      errorBag: 'task',
      only: reloadAfterTaskChange(),
      preserveScroll: true,
      preserveState: true,
    });
  }

  return (
    <form onSubmit={save}>
      <Textarea
        variant="unstyled"
        autosize
        minRows={1}
        classNames={{ input: 'dialog-title' }}
        value={form.data.title}
        onChange={(e) => form.setData('title', e.currentTarget.value)}
        onBlur={() => save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        error={form.errors.title}
        aria-label="Task name"
        style={{
          textDecoration: task.completedAt ? 'line-through' : undefined,
        }}
      />
      <Textarea
        variant="unstyled"
        autosize
        minRows={1}
        placeholder="Description"
        classNames={{ input: 'dialog-description' }}
        value={form.data.description}
        onChange={(e) => form.setData('description', e.currentTarget.value)}
        onBlur={() => save()}
        error={form.errors.description}
        aria-label="Description"
      />
    </form>
  );
}

function Subtasks({ task }: { task: TaskDetail }) {
  const done = task.subtaskRows.filter((t) => t.completedAt).length;
  const { props } = usePage<SharedProps>();
  const [open, { toggle }] = useDisclosure(true);
  return (
    <Box mt="md">
      <UnstyledButton onClick={toggle} mb={4}>
        <Group gap={6}>
          {open ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
          <Text size="sm" fw={600}>
            Sub-tasks
          </Text>
          {task.subtaskRows.length > 0 && (
            <Text size="xs" c="dimmed">
              {done}/{task.subtaskRows.length}
            </Text>
          )}
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>
        {task.subtaskRows.map((sub) => (
          <Group
            key={sub.id}
            gap={10}
            py={7}
            wrap="nowrap"
            className="subtask-row"
            onClick={() => openTask(sub.id)}
          >
            <TaskCheckbox
              priority={sub.priority}
              done={!!sub.completedAt}
              size={18}
              onCheck={() =>
                sub.completedAt ? reopenTask(sub.id) : completeTask(sub)
              }
            />
            <Box style={{ minWidth: 0 }}>
              <Text
                size="sm"
                c={sub.completedAt ? 'dimmed' : undefined}
                td={sub.completedAt ? 'line-through' : undefined}
              >
                {sub.title}
              </Text>
              <TaskMeta task={sub} today={props.today} />
            </Box>
          </Group>
        ))}
        <UnstyledButton
          className="add-task-row"
          py={6}
          onClick={() =>
            openQuickAdd({
              parentId: task.id,
              context: `Sub-task of “${task.title}”`,
            })
          }
        >
          <Group gap={10}>
            <span className="add-task-plus">
              <IconPlus size={14} />
            </span>
            <Text size="sm" c="dimmed" className="add-task-label">
              Add sub-task
            </Text>
          </Group>
        </UnstyledButton>
      </Collapse>
    </Box>
  );
}

function Comment({ comment, mine }: { comment: CommentRow; mine: boolean }) {
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" className="comment">
      <Avatar
        size={28}
        radius="xl"
        color="initials"
        name={comment.author?.name}
      >
        {initials(comment.author?.name ?? '?')}
      </Avatar>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} justify="space-between" wrap="nowrap">
          <Group gap={6}>
            <Text size="sm" fw={600}>
              {comment.author?.name ?? 'Someone who left'}
            </Text>
            <Tooltip
              label={new Date(comment.createdAt).toLocaleString('en-GB')}
            >
              <Text size="xs" c="dimmed">
                {relative(comment.createdAt)} · {clock(comment.createdAt)}
              </Text>
            </Tooltip>
          </Group>
          {mine && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              className="comment-delete"
              aria-label="Delete comment"
              onClick={() =>
                router.delete(`/comments/${comment.id}`, {
                  only: ['comments', 'task'],
                  reset: ['comments'],
                  preserveScroll: true,
                  preserveState: true,
                })
              }
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
        {comment.body && (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.body}
          </Text>
        )}
        {comment.file &&
          (comment.file.isImage ? (
            <Anchor href={comment.file.url} target="_blank">
              <Image
                src={comment.file.url}
                maw={260}
                radius="sm"
                mt={6}
                alt={comment.file.name}
              />
            </Anchor>
          ) : (
            <Paper
              withBorder
              component="a"
              href={comment.file.url}
              p={8}
              mt={6}
              maw={280}
              style={{
                display: 'block',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              <Group gap={8} wrap="nowrap">
                <IconFile size={20} />
                <Box style={{ minWidth: 0 }}>
                  <Text size="sm" truncate>
                    {comment.file.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {fileSize(comment.file.size)}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ))}
      </Box>
    </Group>
  );
}

/**
 * Comments, oldest first, and the box to add one. A file can come along:
 * pick one, or drop it anywhere on the dialog (Mantine's Dropzone). It's a
 * multipart post from the same useForm, with its own error bag.
 */
function Comments({
  task,
  comments,
  sticky = false,
}: {
  task: TaskDetail;
  comments: CommentRow[];
  /** On a phone the box sits at the bottom of the sheet. */
  sticky?: boolean;
}) {
  const { props } = usePage<SharedProps>();
  const me = props.auth.user!;
  const form = useForm<{ body: string; file: File | null }>({
    body: '',
    file: null,
  });
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    form.reset();
    form.clearErrors();
    setFocused(false);
  }, [task.id]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    form.post(`/tasks/${task.id}/comments`, {
      errorBag: 'comment',
      forceFormData: true,
      only: ['comments', 'commentsCursor', 'task', ...reloadAfterTaskChange()],
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        form.reset();
        setFocused(false);
      },
    });
  }
  const errors = form.errors as Record<string, string | undefined>;
  // Todoist keeps the box to one line until you use it.
  const expanded =
    focused || !!form.data.body || !!form.data.file || form.hasErrors;

  const attach = (
    <FileButton
      accept={ACCEPT.join(',')}
      onChange={(file) => form.setData('file', file)}
    >
      {(fileProps) => (
        <Tooltip label="Attach a file (or drop one anywhere)">
          <ActionIcon
            {...fileProps}
            variant="subtle"
            color="gray"
            aria-label="Attach a file"
          >
            <IconPaperclip size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </FileButton>
  );

  const composer = (
    <form onSubmit={submit}>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        {!sticky && (
          <Avatar size={28} radius="xl" color="tomato" mt={4}>
            {initials(me.name)}
          </Avatar>
        )}
        <Paper
          withBorder
          radius={expanded ? 'md' : 'xl'}
          px="sm"
          py={expanded ? 'xs' : 2}
          style={{ flex: 1 }}
          className="comment-box"
        >
          <Group gap={4} wrap="nowrap" align="center">
            <Textarea
              variant="unstyled"
              autosize
              minRows={1}
              maxRows={8}
              placeholder="Comment"
              style={{ flex: 1 }}
              value={form.data.body}
              onFocus={() => setFocused(true)}
              onChange={(e) => form.setData('body', e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
              }}
              aria-label="Comment"
            />
            {!expanded && attach}
          </Group>
          {form.data.file && (
            <Group gap={6} my={4}>
              <IconFile size={14} />
              <Text size="xs" truncate maw={220}>
                {form.data.file.name}
              </Text>
              <Text size="xs" c="dimmed">
                {fileSize(form.data.file.size)}
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => form.setData('file', null)}
                aria-label="Remove file"
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>
          )}
          {form.progress && (
            <Text size="xs" c="dimmed">
              Uploading… {form.progress.percentage}%
            </Text>
          )}
          {expanded && (
            <Group justify="space-between" mt={4}>
              {attach}
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant="light"
                  color="gray"
                  onClick={() => {
                    form.reset();
                    form.clearErrors();
                    setFocused(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="compact-sm"
                  type="submit"
                  loading={form.processing}
                  disabled={!form.data.body.trim() && !form.data.file}
                >
                  Comment
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      </Group>
      {(errors.body || errors.file) && (
        <Text size="xs" c="red" mt={4} ml={sticky ? 0 : 40}>
          {errors.body ?? errors.file}
        </Text>
      )}
    </form>
  );

  return (
    <Box
      mt={sticky ? undefined : 'lg'}
      style={sticky ? { marginTop: 'auto', paddingTop: 16 } : undefined}
    >
      {comments.length > 0 && (
        <Text size="sm" fw={600} mb="xs">
          Comments{' '}
          <Text span c="dimmed" size="xs">
            {comments.length}
          </Text>
        </Text>
      )}
      <Stack gap="md" mb="md" data-xray="comments">
        {[...comments].reverse().map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            mine={comment.author?.id === me.id}
          />
        ))}
      </Stack>
      <Dropzone.FullScreen
        accept={ACCEPT}
        maxSize={10 * 1024 * 1024}
        multiple={false}
        onDrop={([file]) => {
          form.setData('file', file);
          setFocused(true);
        }}
      >
        <Stack align="center" justify="center" mih="60vh" gap="xs">
          <IconUpload size={48} stroke={1.5} />
          <Text size="lg">Drop it to attach it to “{task.title}”</Text>
          <Text size="sm" c="dimmed">
            Images, text, PDF and archives, up to 10 MB.
          </Text>
        </Stack>
      </Dropzone.FullScreen>
      {sticky ? <div className="sheet-composer">{composer}</div> : composer}
    </Box>
  );
}

/** A property in the dialog: an icon and its value, the whole row a button. */
function PropRow({
  icon,
  children,
  dimmed = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <UnstyledButton className="prop-row" component="div" role="button">
      <Group gap={10} wrap="nowrap">
        <Box c={dimmed ? 'dimmed' : undefined} style={{ display: 'flex' }}>
          {icon}
        </Box>
        <Text
          size="sm"
          c={dimmed ? 'dimmed' : undefined}
          truncate
          component="div"
        >
          {children}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

function Field({
  label,
  layout,
  children,
}: {
  label: string;
  layout: 'side' | 'rows';
  children: ReactNode;
}) {
  if (layout === 'rows') return <Box className="prop-field">{children}</Box>;
  return (
    <Box className="prop-field">
      <Text size="xs" c="dimmed" fw={600} px={8} mb={2}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

/**
 * Project, date, priority, labels, assignee. On a big screen it's the
 * dialog's right column, a label over each value; on a phone, a card of
 * rows. Each row opens its picker.
 */
function Properties({
  task,
  layout,
}: {
  task: TaskDetail;
  layout: 'side' | 'rows';
}) {
  const { today } = usePage<SharedProps>().props;
  const projectName = task.project.isInbox ? 'Inbox' : task.project.name;
  return (
    <Stack gap={layout === 'side' ? 'sm' : 0}>
      <Field label="Project" layout={layout}>
        {task.parent ? (
          <PropRow icon={<ProjectIcon project={task.project} size={16} />}>
            {projectName}
          </PropRow>
        ) : (
          <ProjectPicker
            value={task.project.id}
            onChange={(projectId) => updateTask(task, { projectId }, {})}
          >
            <PropRow icon={<ProjectIcon project={task.project} size={16} />}>
              {projectName}
              {task.section && (
                <Text span c="dimmed" size="sm">
                  {' '}
                  / {task.section.name}
                </Text>
              )}
            </PropRow>
          </ProjectPicker>
        )}
      </Field>
      <Field label="Date" layout={layout}>
        <DuePicker
          value={{
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            recurrence: task.recurrence,
          }}
          onChange={(due) => updateTask(task, { ...due })}
        >
          <PropRow
            dimmed={!task.dueDate}
            icon={
              task.recurrence ? (
                <IconRepeat
                  size={16}
                  color={
                    task.dueDate ? dueColor(task.dueDate, today) : undefined
                  }
                />
              ) : (
                <IconCalendarEvent
                  size={16}
                  color={
                    task.dueDate ? dueColor(task.dueDate, today) : undefined
                  }
                />
              )
            }
          >
            {task.dueDate ? (
              <Text span size="sm" c={dueColor(task.dueDate, today)}>
                {dueLabel(task.dueDate, today)}
                {task.dueTime && ` ${task.dueTime}`}
              </Text>
            ) : (
              'Date'
            )}
          </PropRow>
        </DuePicker>
      </Field>
      <Field label="Priority" layout={layout}>
        <PriorityPicker
          value={task.priority}
          onChange={(priority) => updateTask(task, { priority })}
        >
          <PropRow icon={<PriorityFlag priority={task.priority} />}>
            {layout === 'rows'
              ? `Priority ${task.priority}`
              : `P${task.priority}`}
          </PropRow>
        </PriorityPicker>
      </Field>
      <Field label="Labels" layout={layout}>
        <LabelsPicker
          value={task.labels.map((l) => l.name)}
          onChange={(labels) =>
            updateTask(
              task,
              { labels },
              {
                labels: labels.map(
                  (name, i) =>
                    task.labels.find((l) => l.name === name) ?? {
                      id: -i - 1,
                      name,
                      color: 'charcoal',
                    },
                ),
              },
            )
          }
        >
          <PropRow dimmed={!task.labels.length} icon={<IconTag size={16} />}>
            {task.labels.length ? (
              <Group gap={4}>
                {task.labels.map((l) => (
                  <Badge
                    key={l.id}
                    variant="light"
                    color="gray"
                    radius="sm"
                    tt="none"
                    fw={500}
                    leftSection={<IconTag size={10} color={colorOf(l.color)} />}
                  >
                    {l.name}
                  </Badge>
                ))}
              </Group>
            ) : (
              'Labels'
            )}
          </PropRow>
        </LabelsPicker>
      </Field>
      {task.people.length > 0 && (
        <Field label="Assignee" layout={layout}>
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <Box>
                <PropRow
                  dimmed={!task.assignee}
                  icon={
                    task.assignee ? (
                      <Avatar
                        size={18}
                        radius="xl"
                        color="initials"
                        name={task.assignee.name}
                      >
                        {initials(task.assignee.name)}
                      </Avatar>
                    ) : (
                      <IconUser size={16} />
                    )
                  }
                >
                  {task.assignee?.name ?? 'Assignee'}
                </PropRow>
              </Box>
            </Menu.Target>
            <Menu.Dropdown>
              {task.people.map((person) => (
                <Menu.Item
                  key={person.id}
                  leftSection={
                    <Avatar
                      size={20}
                      radius="xl"
                      color="initials"
                      name={person.name}
                    >
                      {initials(person.name)}
                    </Avatar>
                  }
                  fw={task.assignee?.id === person.id ? 600 : undefined}
                  onClick={() =>
                    updateTask(
                      task,
                      { assigneeId: person.id },
                      { assignee: person },
                    )
                  }
                >
                  {person.name}
                </Menu.Item>
              ))}
              {task.assignee && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconX size={16} />}
                    onClick={() =>
                      updateTask(task, { assigneeId: null }, { assignee: null })
                    }
                  >
                    Unassign
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Field>
      )}
    </Stack>
  );
}

/**
 * The task dialog, on every list page. `task` arrives with a partial reload
 * when the URL gets `?task=`; see openTask(). Opening the URL directly (a
 * shared link, a refresh) paints the list first and then asks for the task,
 * because `task` is `optional()`: never part of a normal visit.
 *
 * In a shared project the comments poll: every five seconds it asks for
 * just `comments`, with the time it last heard, and `prepend()` puts the
 * new ones on the pile.
 */
export function TaskDialog() {
  const page = usePage<SharedProps & DetailProps>();
  const { task: current, comments = [], commentsCursor } = page.props;
  // While the dialog animates closed, keep showing the task it had.
  const last = useRef(current);
  if (current) last.current = current;
  const task = current ?? last.current;
  const phone = useMediaQuery('(max-width: 48em)');
  const wanted = new URLSearchParams(page.url.split('?')[1] ?? '').get('task');

  useEffect(() => {
    if (wanted && current === undefined)
      router.reload({ only: ['task', 'comments', 'commentsCursor'] });
  }, [wanted, current === undefined]);

  const shared = !!task && task.people.length > 1;
  const poll = usePoll(
    5000,
    () => ({
      only: ['comments', 'commentsCursor'],
      headers: { 'X-Comments-Since': commentsCursor ?? '' },
    }),
    { autoStart: false },
  );
  useEffect(() => {
    if (shared && wanted) poll.start();
    else poll.stop();
    return () => poll.stop();
  }, [shared, wanted]);

  const opened = !!wanted && !!current;
  const { previous, next } = task
    ? neighbours(task.id)
    : { previous: null, next: null };

  const breadcrumb = task && (
    <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
      {/* Takes the dialog's first focus, so nothing lights up on open. */}
      <span tabIndex={-1} data-autofocus />
      {task.project.isInbox ? (
        <IconInbox size={14} />
      ) : (
        <IconHash size={14} color={colorOf(task.project.color)} />
      )}
      <Anchor
        component={Link}
        href={task.project.isInbox ? '/inbox' : `/projects/${task.project.id}`}
        size="sm"
        c="dimmed"
        truncate
      >
        {task.project.isInbox ? 'Inbox' : task.project.name}
        {task.section && ` / ${task.section.name}`}
      </Anchor>
      {task.parent && (
        <Anchor
          size="sm"
          c="dimmed"
          truncate
          onClick={() => openTask(task.parent!.id)}
        >
          / {task.parent.title}
        </Anchor>
      )}
    </Group>
  );

  const moreMenu = task && (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant={phone ? 'default' : 'subtle'}
          color="gray"
          radius="xl"
          size={phone ? 'lg' : 'md'}
          aria-label="More"
        >
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={() => deleteTask(task, closeTask)}
        >
          Delete task
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const stepper = (
    <>
      <Tooltip label="Previous task">
        <ActionIcon
          variant="subtle"
          color="gray"
          disabled={!previous}
          onClick={() => previous && openTask(previous)}
          aria-label="Previous task"
        >
          <IconChevronUp size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Next task">
        <ActionIcon
          variant="subtle"
          color="gray"
          disabled={!next}
          onClick={() => next && openTask(next)}
          aria-label="Next task"
        >
          <IconChevronDown size={18} />
        </ActionIcon>
      </Tooltip>
    </>
  );

  const titleBlock = task && (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <Box pt={6}>
        <TaskCheckbox
          priority={task.priority}
          done={!!task.completedAt}
          size={22}
          onCheck={() =>
            task.completedAt ? reopenTask(task.id) : completeTask(task)
          }
        />
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <TitleForm task={task} />
      </Box>
    </Group>
  );

  // Todoist's iOS sheet: round buttons on top, the task and its properties
  // in one card, sub-tasks in the next, the comment box pinned underneath.
  if (phone)
    return (
      <Drawer
        opened={opened}
        onClose={closeTask}
        position="bottom"
        size="94%"
        withCloseButton={false}
        padding={0}
        radius="lg"
        classNames={{ content: 'sheet sheet-grouped' }}
      >
        {task && (
          <Stack gap={0} style={{ flex: 1 }}>
            <Group
              justify="space-between"
              px="md"
              pt="md"
              pb="sm"
              wrap="nowrap"
            >
              <ActionIcon
                variant="default"
                radius="xl"
                size="lg"
                onClick={closeTask}
                aria-label="Close"
              >
                <IconX size={18} />
              </ActionIcon>
              <Group gap={4} wrap="nowrap">
                <span tabIndex={-1} data-autofocus />
                {stepper}
                {moreMenu}
              </Group>
            </Group>
            <Box
              px="md"
              pb="md"
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <div className="group-card sheet-card">
                <Box px="sm" pt="sm" pb={4}>
                  {titleBlock}
                </Box>
                <Properties task={task} layout="rows" />
              </div>
              {!task.parent && (
                <div
                  className="group-card sheet-card"
                  style={{ marginTop: 12 }}
                >
                  <Box px="sm" pb="xs">
                    <Subtasks task={task} />
                  </Box>
                </div>
              )}
              <Comments task={task} comments={comments} sticky />
            </Box>
          </Stack>
        )}
      </Drawer>
    );

  return (
    <Modal
      opened={opened}
      onClose={closeTask}
      withCloseButton={false}
      padding={0}
      size={880}
      yOffset="5vh"
      aria-label="Task"
    >
      {task && (
        <>
          <Group
            justify="space-between"
            wrap="nowrap"
            px="md"
            py="xs"
            className="dialog-header"
          >
            {breadcrumb}
            <Group gap={2} wrap="nowrap">
              {stepper}
              {moreMenu}
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={closeTask}
                aria-label="Close"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>
          </Group>
          <Divider />
          <Group align="stretch" gap={0} wrap="nowrap" h="min(82vh, 640px)">
            <ScrollArea style={{ flex: 1 }}>
              <Box p="lg">
                {titleBlock}
                {!task.parent && <Subtasks task={task} />}
                <Comments task={task} comments={comments} />
              </Box>
            </ScrollArea>
            <Box w={270} p="sm" className="dialog-side">
              <Properties task={task} layout="side" />
            </Box>
          </Group>
        </>
      )}
    </Modal>
  );
}
