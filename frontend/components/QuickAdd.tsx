import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Text,
  Textarea,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { IconArrowUp } from '@tabler/icons-react';
import { useForm, useHttp } from 'nestjs-mvc/react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { type QuickAddDefaults, onQuickAdd } from '../lib/quickAdd';
import { reloadAfterTaskChange } from '../lib/tasks';
import {
  type Due,
  DuePicker,
  LabelsPicker,
  PriorityPicker,
  ProjectPicker,
} from './Pickers';

interface Token {
  kind: 'date' | 'time' | 'recurrence' | 'priority' | 'label' | 'project';
  start: number;
  end: number;
}

interface Parsed {
  text: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  recurrence: string | null;
  priority: 1 | 2 | 3 | 4 | null;
  labels: string[];
  projectId: number | null;
  tokens: Token[];
}

/** The text with what the server understood marked, laid under the textarea. */
function Highlights({ text, tokens }: { text: string; tokens: Token[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const token of tokens) {
    parts.push(text.slice(at, token.start));
    parts.push(
      <mark key={token.start} data-kind={token.kind}>
        {text.slice(token.start, token.end)}
      </mark>,
    );
    at = token.end;
  }
  parts.push(text.slice(at), '​');
  return (
    <div className="qa-mirror" aria-hidden>
      {parts}
    </div>
  );
}

const blank = (defaults: QuickAddDefaults) => ({
  text: '',
  description: '',
  sectionId: defaults.sectionId ?? null,
  parentId: defaults.parentId ?? null,
  // Where you were: the text wins when it says otherwise.
  defaultProjectId: defaults.projectId ?? null,
  defaultDueDate: defaults.dueDate ?? null,
});

/**
 * Quick add. Type "Pay rent every month p2 #Home" and it lights up what it
 * understood while you type: each pause asks GET /tasks/parse with useHttp,
 * a plain JSON request that leaves the page alone. On Add, the server
 * parses the same text again, so what you see is what you get. The buttons
 * underneath override the text.
 */
export function QuickAdd() {
  const phone = useMediaQuery('(max-width: 48em)');
  const [opened, setOpened] = useState(false);
  const [defaults, setDefaults] = useState<QuickAddDefaults>({});
  // What the buttons chose; null means "whatever the text says".
  const [due, setDue] = useState<Due | null>(null);
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | null>(null);
  const [labels, setLabels] = useState<string[] | null>(null);
  const [project, setProject] = useState<number | null>(null);

  const form = useForm(blank({}));
  const parse = useHttp<{ text: string }, Parsed>({ text: '' });
  const [text] = useDebouncedValue(form.data.text, 120);

  useEffect(
    () =>
      onQuickAdd((next) => {
        setDefaults(next);
        form.setDefaults(blank(next));
        form.reset();
        form.clearErrors();
        setDue(null);
        setPriority(null);
        setLabels(null);
        setProject(null);
        setOpened(true);
      }),
    [],
  );

  useEffect(() => {
    if (!text.trim()) return;
    parse.setData('text', text);
  }, [text]);
  useEffect(() => {
    if (!parse.data.text.trim()) return;
    parse.cancel();
    parse.get('/tasks/parse').catch(() => {
      // Cancelled by the next keystroke: the next answer will do.
    });
  }, [parse.data.text]);

  const fresh =
    parse.response && parse.response.text === form.data.text
      ? parse.response
      : null;
  const shownDue: Due = due ?? {
    dueDate: fresh?.dueDate ?? defaults.dueDate ?? null,
    dueTime: fresh?.dueTime ?? null,
    recurrence: fresh?.recurrence ?? null,
  };
  const shownPriority = priority ?? fresh?.priority ?? 4;
  const shownLabels = labels ?? fresh?.labels ?? [];
  const shownProject =
    project ?? fresh?.projectId ?? defaults.projectId ?? null;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!form.data.text.trim() || form.processing) return;
    form.transform((data) => ({
      ...data,
      ...(project ? { projectId: project } : {}),
      ...due,
      ...(priority ? { priority } : {}),
      ...(labels ? { labels } : {}),
    }));
    form.post('/tasks', {
      only: reloadAfterTaskChange().filter((p) => p !== 'task'),
      preserveScroll: true,
      preserveState: true,
      errorBag: 'quickAdd',
      onSuccess: () => {
        form.reset();
        setDue(null);
        setPriority(null);
        setLabels(null);
        // Adding a sub-task is one at a time; the rest keep the box open
        // for the next one, like Todoist.
        if (defaults.parentId) setOpened(false);
      },
    });
  }

  const errors = form.errors as Record<string, string | undefined>;
  const content = (
    <form onSubmit={submit}>
      <Box px="md" pt="md">
        <div className="qa-field">
          <Highlights text={form.data.text} tokens={fresh?.tokens ?? []} />
          <Textarea
            data-autofocus
            variant="unstyled"
            autosize
            minRows={1}
            maxRows={6}
            placeholder={
              defaults.parentId
                ? 'Sub-task name'
                : 'e.g. Pay rent every month p2 #Home'
            }
            classNames={{ input: 'qa-input' }}
            value={form.data.text}
            onChange={(e) => form.setData('text', e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            aria-label="Task name"
          />
        </div>
        <Textarea
          variant="unstyled"
          autosize
          minRows={1}
          maxRows={4}
          placeholder="Description"
          size="sm"
          classNames={{ input: 'qa-description' }}
          value={form.data.description}
          onChange={(e) => form.setData('description', e.currentTarget.value)}
        />
        {(errors.text || errors.projectId || errors.assigneeId) && (
          <Text size="xs" c="red" mt={4}>
            {errors.text ?? errors.projectId ?? errors.assigneeId}
          </Text>
        )}
        {/* One row of chips; on a phone it scrolls sideways, like Todoist's. */}
        <Group gap={6} py="sm" wrap="nowrap" className="chip-row">
          <DuePicker value={shownDue} onChange={setDue} />
          <PriorityPicker value={shownPriority} onChange={setPriority} />
          <LabelsPicker value={shownLabels} onChange={setLabels} />
        </Group>
      </Box>
      <Divider />
      <Group justify="space-between" px="md" py="sm" wrap="nowrap">
        {defaults.parentId ? (
          <Text size="xs" c="dimmed">
            {defaults.context ?? 'Sub-task'}
          </Text>
        ) : (
          <ProjectPicker value={shownProject} onChange={setProject} />
        )}
        {phone ? (
          <ActionIcon
            type="submit"
            radius="xl"
            size={38}
            variant="filled"
            disabled={!form.data.text.trim()}
            loading={form.processing}
            aria-label="Add task"
          >
            <IconArrowUp size={20} />
          </ActionIcon>
        ) : (
          <Group gap="xs">
            <Button
              variant="light"
              color="gray"
              onClick={() => setOpened(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.data.text.trim()}
              loading={form.processing}
            >
              Add task
            </Button>
          </Group>
        )}
      </Group>
    </form>
  );

  return phone ? (
    <Drawer
      opened={opened}
      onClose={() => setOpened(false)}
      position="bottom"
      size="auto"
      withCloseButton={false}
      padding={0}
      radius="lg"
      classNames={{ content: 'sheet' }}
      styles={{ content: { height: 'auto', maxHeight: '92dvh' } }}
    >
      {content}
    </Drawer>
  ) : (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      withCloseButton={false}
      padding={0}
      size={560}
      yOffset="12vh"
      aria-label="Quick add"
    >
      {content}
    </Modal>
  );
}
