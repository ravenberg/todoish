import {
  ActionIcon,
  Box,
  Button,
  Code,
  Collapse,
  ColorSwatch,
  Group,
  Menu,
  Modal,
  NavLink,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconDroplet,
  IconPlus,
  IconTag,
  IconTrash,
} from '@tabler/icons-react';
import { Link, router, useForm } from 'nestjs-mvc/react';
import type { FormEvent, ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { COLOR_OPTIONS, colorOf } from '../../lib/colors';
import { appLayout } from '../../layouts/AppLayout';

interface Props {
  filters: { id: number; name: string; query: string; color: string }[];
  labels: { id: number; name: string; color: string; count: number }[];
}

const EXAMPLES = [
  'today & p1',
  '(today | overdue) & #Work',
  '7 days & @errands',
  'assigned to me & !@waiting',
  'no date & #Inbox',
];

/**
 * A new filter. The query is checked as you type: Precognition sends the
 * form to POST /filters and asks only to validate, and the server's own
 * parser answers. Nothing is saved until you press Add.
 */
export function FilterForm({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const form = useForm('post', '/filters', {
    name: '',
    query: '',
    color: 'charcoal',
  });
  form.setValidationTimeout(400);

  function submit(event: FormEvent) {
    event.preventDefault();
    form.submit({
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add filter" size="md">
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Name"
            data-autofocus
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            onBlur={() => form.validate('name')}
            error={form.invalid('name') && form.errors.name}
          />
          <TextInput
            label="Query"
            placeholder="today & p1"
            ff="monospace"
            value={form.data.query}
            onChange={(e) => {
              form.setData('query', e.currentTarget.value);
              form.validate('query');
            }}
            error={form.invalid('query') && form.errors.query}
            description={
              form.validating
                ? 'Asking the server…'
                : form.valid('query')
                  ? 'Looks good.'
                  : 'today, overdue, 7 days, p1, @label, #project, assigned to me. Combine with & | ! ( ).'
            }
          />
          <Group gap={6}>
            {EXAMPLES.map((example) => (
              <Code
                key={example}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  form.setData('query', example);
                  form.validate('query');
                }}
              >
                {example}
              </Code>
            ))}
          </Group>
          <Select
            label="Color"
            data={COLOR_OPTIONS}
            value={form.data.color}
            allowDeselect={false}
            leftSection={
              <ColorSwatch color={colorOf(form.data.color)} size={14} />
            }
            onChange={(color) => color && form.setData('color', color)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={form.processing}>
              Add
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function LabelForm({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const form = useForm({ name: '', color: 'charcoal' });
  function submit(event: FormEvent) {
    event.preventDefault();
    form.post('/labels', {
      onSuccess: () => {
        form.reset();
        onClose();
      },
      preserveScroll: true,
      errorBag: 'label',
    });
  }
  return (
    <Modal opened={opened} onClose={onClose} title="Add label" size="sm">
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Name"
            data-autofocus
            leftSection="@"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            error={form.errors.name}
          />
          <Select
            label="Color"
            data={COLOR_OPTIONS}
            value={form.data.color}
            allowDeselect={false}
            leftSection={
              <ColorSwatch color={colorOf(form.data.color)} size={14} />
            }
            onChange={(color) => color && form.setData('color', color)}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={form.processing}>
              Add
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** A section header, Todoist style: a chevron to fold it, a + to add. */
function Section({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  const [open, { toggle }] = useDisclosure(true);
  return (
    <Box mb="lg">
      <Group justify="space-between" mb={4} className="fold-header">
        <UnstyledButton onClick={toggle}>
          <Group gap={6}>
            {open ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
            <Text fw={700}>{title}</Text>
          </Group>
        </UnstyledButton>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onAdd}
          aria-label={addLabel}
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>
      <Collapse expanded={open}>{children}</Collapse>
    </Box>
  );
}

export default function Index({ filters, labels }: Props) {
  const [filterOpened, filterForm] = useDisclosure(false);
  const [labelOpened, labelForm] = useDisclosure(false);
  return (
    <Box data-grouped>
      <PageHeader title="Filters & Labels" />
      <Section title="My Filters" onAdd={filterForm.open} addLabel="Add filter">
        <div className="group-card fold-list" data-xray="filters">
          {filters.map((f) => (
            <NavLink
              key={f.id}
              component={Link}
              href={`/filters/${f.id}`}
              prefetch
              label={f.name}
              leftSection={<IconDroplet size={18} color={colorOf(f.color)} />}
            />
          ))}
          {filters.length === 0 && (
            <Text size="sm" c="dimmed" p="md">
              Your filters show up here. Try “today &amp; p1”.
            </Text>
          )}
        </div>
      </Section>

      <Section title="Labels" onAdd={labelForm.open} addLabel="Add label">
        <div className="group-card fold-list" data-xray="labels">
          {labels.map((l) => (
            <Group
              key={l.id}
              justify="space-between"
              wrap="nowrap"
              pr="xs"
              gap={0}
              className="label-row"
            >
              <Box style={{ flex: 1, minWidth: 0 }}>
                <NavLink
                  component={Link}
                  href={`/labels/${l.id}`}
                  prefetch
                  label={l.name}
                  leftSection={<IconTag size={18} color={colorOf(l.color)} />}
                  rightSection={
                    <Text size="xs" c="dimmed">
                      {l.count || ''}
                    </Text>
                  }
                />
              </Box>
              <Menu position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    className="row-menu"
                    aria-label="Label actions"
                  >
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => router.delete(`/labels/${l.id}`)}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ))}
        </div>
      </Section>
      <FilterForm opened={filterOpened} onClose={filterForm.close} />
      <LabelForm opened={labelOpened} onClose={labelForm.close} />
    </Box>
  );
}

Index.layout = appLayout;
