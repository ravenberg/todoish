import {
  ActionIcon,
  Anchor,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  FileButton,
  Group,
  Image,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconFile,
  IconHash,
  IconInbox,
  IconPaperclip,
  IconSubtask,
  IconTrash,
  IconUpload,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { Link, router, useForm, usePage, usePoll } from 'nestjs-mvc/react';
import { type FormEvent, type ReactNode, useEffect } from 'react';
import { colorOf } from '../lib/colors';
import { clock, fileSize, initials, relative } from '../lib/format';
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
  PriorityPicker,
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
  return (
    <Box mt="md">
      <Group gap={6} mb={4}>
        <IconSubtask size={16} />
        <Text size="sm" fw={600}>
          Sub-tasks
        </Text>
        {task.subtaskRows.length > 0 && (
          <Text size="xs" c="dimmed">
            {done}/{task.subtaskRows.length}
          </Text>
        )}
      </Group>
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
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        mt={4}
        fw={400}
        onClick={() =>
          openQuickAdd({
            parentId: task.id,
            context: `Sub-task of “${task.title}”`,
          })
        }
      >
        + Add sub-task
      </Button>
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
}: {
  task: TaskDetail;
  comments: CommentRow[];
}) {
  const { props } = usePage<SharedProps>();
  const form = useForm<{ body: string; file: File | null }>({
    body: '',
    file: null,
  });
  useEffect(() => {
    form.reset();
    form.clearErrors();
  }, [task.id]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    form.post(`/tasks/${task.id}/comments`, {
      errorBag: 'comment',
      forceFormData: true,
      only: ['comments', 'commentsCursor', 'task', ...reloadAfterTaskChange()],
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => form.reset(),
    });
  }
  const errors = form.errors as Record<string, string | undefined>;

  return (
    <Box mt="lg">
      <Text size="sm" fw={600} mb="xs">
        Comments{' '}
        {comments.length > 0 && (
          <Text span c="dimmed" size="xs">
            {comments.length}
          </Text>
        )}
      </Text>
      <Stack gap="md" mb="md" data-xray="comments">
        {[...comments].reverse().map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            mine={comment.author?.id === props.auth.user?.id}
          />
        ))}
      </Stack>
      <Dropzone.FullScreen
        accept={ACCEPT}
        maxSize={10 * 1024 * 1024}
        multiple={false}
        onDrop={([file]) => form.setData('file', file)}
      >
        <Stack align="center" justify="center" mih="60vh" gap="xs">
          <IconUpload size={48} stroke={1.5} />
          <Text size="lg">Drop it to attach it to “{task.title}”</Text>
          <Text size="sm" c="dimmed">
            Images, text, PDF and archives, up to 10 MB.
          </Text>
        </Stack>
      </Dropzone.FullScreen>
      <form onSubmit={submit}>
        <Paper withBorder radius="md" p="xs">
          <Textarea
            variant="unstyled"
            autosize
            minRows={1}
            maxRows={8}
            placeholder="Comment"
            value={form.data.body}
            onChange={(e) => form.setData('body', e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            aria-label="Comment"
          />
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
          <Group justify="space-between" mt={4}>
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
            <Button
              size="compact-sm"
              type="submit"
              loading={form.processing}
              disabled={!form.data.body.trim() && !form.data.file}
            >
              Comment
            </Button>
          </Group>
        </Paper>
        {(errors.body || errors.file) && (
          <Text size="xs" c="red" mt={4}>
            {errors.body ?? errors.file}
          </Text>
        )}
      </form>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" fw={600} mb={4}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

/** Project, date, priority, labels, assignee: the dialog's right column. */
function Properties({ task }: { task: TaskDetail }) {
  return (
    <Stack gap="md">
      <Field label="Project">
        {task.parent ? (
          <Text size="sm">
            {task.project.isInbox ? 'Inbox' : task.project.name}
          </Text>
        ) : (
          <ProjectPicker
            value={task.project.id}
            variant="default"
            onChange={(projectId) => updateTask(task, { projectId }, {})}
          />
        )}
      </Field>
      <Field label="Date">
        <DuePicker
          value={{
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            recurrence: task.recurrence,
          }}
          onChange={(due) => updateTask(task, { ...due })}
        />
      </Field>
      <Field label="Priority">
        <PriorityPicker
          value={task.priority}
          onChange={(priority) => updateTask(task, { priority })}
        />
      </Field>
      <Field label="Labels">
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
        />
      </Field>
      {task.people.length > 0 && (
        <Field label="Assignee">
          <Select
            size="xs"
            placeholder="Nobody"
            clearable
            leftSection={<IconUser size={14} />}
            value={task.assignee ? String(task.assignee.id) : null}
            data={task.people.map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
            comboboxProps={{ withinPortal: true }}
            onChange={(id) =>
              updateTask(
                task,
                { assigneeId: id ? Number(id) : null },
                {
                  assignee:
                    task.people.find((p) => p.id === Number(id)) ?? null,
                },
              )
            }
          />
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
  const { task, comments = [], commentsCursor } = page.props;
  const phone = useMediaQuery('(max-width: 48em)');
  const wanted = new URLSearchParams(page.url.split('?')[1] ?? '').get('task');

  useEffect(() => {
    if (wanted && task === undefined)
      router.reload({ only: ['task', 'comments', 'commentsCursor'] });
  }, [wanted, task === undefined]);

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

  const opened = !!wanted && !!task;
  const { previous, next } = task
    ? neighbours(task.id)
    : { previous: null, next: null };

  const header = task && (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="md"
      py="xs"
      className="dialog-header"
    >
      <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
        {task.project.isInbox ? (
          <IconInbox size={14} />
        ) : (
          <IconHash size={14} color={colorOf(task.project.color)} />
        )}
        <Anchor
          component={Link}
          href={
            task.project.isInbox ? '/inbox' : `/projects/${task.project.id}`
          }
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
      <Group gap={2} wrap="nowrap">
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
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="More">
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
  );

  const main = task && (
    <Box>
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
      {!task.parent && <Subtasks task={task} />}
      <Comments task={task} comments={comments} />
    </Box>
  );

  if (phone)
    return (
      <Drawer
        opened={opened}
        onClose={closeTask}
        position="bottom"
        size="92%"
        withCloseButton={false}
        padding={0}
        radius="lg"
        classNames={{ content: 'sheet' }}
      >
        {header}
        <Divider />
        <Box p="md" pb="xl">
          {main}
          <Divider my="md" />
          {task && <Properties task={task} />}
        </Box>
      </Drawer>
    );

  return (
    <Modal
      opened={opened}
      onClose={closeTask}
      withCloseButton={false}
      padding={0}
      size={860}
      yOffset="6vh"
      aria-label="Task"
    >
      {header}
      <Divider />
      <Group align="stretch" gap={0} wrap="nowrap" mih={420}>
        <ScrollArea.Autosize mah="78vh" style={{ flex: 1 }}>
          <Box p="lg">{main}</Box>
        </ScrollArea.Autosize>
        <Box w={260} p="md" className="dialog-side">
          {task && <Properties task={task} />}
        </Box>
      </Group>
    </Modal>
  );
}
