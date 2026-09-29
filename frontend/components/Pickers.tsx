import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Combobox,
  Divider,
  Group,
  Menu,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Text,
  UnstyledButton,
  useCombobox,
} from '@mantine/core';
import { DatePicker, TimeInput } from '@mantine/dates';
import {
  IconArmchair,
  IconArrowRight,
  IconBan,
  IconCalendarEvent,
  IconCheck,
  IconChevronDown,
  IconFlag,
  IconHash,
  IconInbox,
  IconPlus,
  IconRepeat,
  IconSun,
  IconTag,
  IconX,
} from '@tabler/icons-react';
import { usePage } from 'nestjs-mvc/react';
import { type ReactNode, useState } from 'react';
import { PRIORITY_COLOR, colorOf } from '../lib/colors';
import { addDays, dueColor, dueLabel } from '../lib/format';
import type { SharedProps } from '../types';

export interface Due {
  dueDate: string | null;
  dueTime: string | null;
  recurrence: string | null;
}

const weekdayOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};
const nextWeekday = (from: string, weekday: number) => {
  const offset = (weekday - weekdayOf(from) + 7) % 7 || 7;
  return addDays(from, offset);
};

const REPEATS = [
  { value: '', label: 'Doesn’t repeat' },
  { value: 'every day', label: 'Every day' },
  { value: 'every weekday', label: 'Every weekday' },
  { value: 'every week', label: 'Every week' },
  { value: 'every 2 weeks', label: 'Every other week' },
  { value: 'every month', label: 'Every month' },
  { value: 'every year', label: 'Every year' },
];

/**
 * Todoist's date menu: the usual answers at the top, a calendar below,
 * then a time and a repeat. The chip that opens it shows the date in its
 * colour, like the task row does.
 */
export function DuePicker({
  value,
  onChange,
  children,
}: {
  value: Due;
  onChange: (due: Due) => void;
  /** Replaces the default chip. */
  children?: ReactNode;
}) {
  const today = usePage<SharedProps>().props.today;
  const [opened, setOpened] = useState(false);
  const set = (patch: Partial<Due>, close = true) => {
    const next = { ...value, ...patch };
    if (!next.dueDate) Object.assign(next, { dueTime: null, recurrence: null });
    onChange(next);
    if (close) setOpened(false);
  };
  const quick: [string, ReactNode, string | null, string][] = [
    ['Today', <IconCalendarEvent size={16} />, today, '#058527'],
    ['Tomorrow', <IconSun size={16} />, addDays(today, 1), '#ad6200'],
    [
      'This weekend',
      <IconArmchair size={16} />,
      nextWeekday(addDays(today, -1), 6),
      '#246fe0',
    ],
    [
      'Next week',
      <IconArrowRight size={16} />,
      nextWeekday(today, 1),
      '#692ec2',
    ],
    ['No date', <IconBan size={16} />, null, 'var(--mantine-color-dimmed)'],
  ];

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={272}
      trapFocus
      withinPortal
    >
      <Popover.Target>
        {children ? (
          <Box onClick={() => setOpened((o) => !o)}>{children}</Box>
        ) : (
          <Button
            size="compact-sm"
            variant="default"
            fw={400}
            c={value.dueDate ? dueColor(value.dueDate, today) : 'dimmed'}
            leftSection={
              value.recurrence ? (
                <IconRepeat size={14} />
              ) : (
                <IconCalendarEvent size={14} />
              )
            }
            rightSection={
              value.dueDate ? (
                <IconX
                  size={12}
                  onClick={(event) => {
                    event.stopPropagation();
                    set({ dueDate: null });
                  }}
                />
              ) : undefined
            }
            onClick={() => setOpened((o) => !o)}
          >
            {value.dueDate
              ? `${dueLabel(value.dueDate, today)}${value.dueTime ? ` ${value.dueTime}` : ''}`
              : 'Date'}
          </Button>
        )}
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Stack gap={0} py={4}>
          {quick.map(([label, icon, day, color]) => (
            <UnstyledButton
              key={label}
              className="menu-row"
              onClick={() => set({ dueDate: day })}
            >
              <Group justify="space-between" px="sm" py={6}>
                <Group gap={10} c={color}>
                  {icon}
                  <Text size="sm" c="var(--mantine-color-text)">
                    {label}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {day
                    ? new Date(`${day}T12:00`).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        ...(label === 'Next week'
                          ? { day: 'numeric', month: 'short' }
                          : {}),
                      })
                    : ''}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
        <Divider />
        <Box p="xs">
          <DatePicker
            size="xs"
            value={value.dueDate}
            onChange={(day) => set({ dueDate: day }, false)}
            minDate={addDays(today, -365)}
            firstDayOfWeek={1}
            getDayProps={(day) =>
              day === today
                ? {
                    style: {
                      color: 'var(--mantine-color-tomato-6)',
                      fontWeight: 700,
                    },
                  }
                : {}
            }
          />
        </Box>
        <Divider />
        <Stack gap={6} p="xs">
          <TimeInput
            size="xs"
            label="Time"
            value={value.dueTime ?? ''}
            disabled={!value.dueDate}
            onChange={(event) =>
              set({ dueTime: event.currentTarget.value || null }, false)
            }
          />
          <Select
            size="xs"
            label="Repeat"
            data={REPEATS}
            value={value.recurrence ?? ''}
            disabled={!value.dueDate}
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
            onChange={(repeat) => set({ recurrence: repeat || null }, false)}
          />
          <Button size="xs" mt={4} onClick={() => setOpened(false)}>
            Done
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export function PriorityFlag({
  priority,
  size = 16,
}: {
  priority: number;
  size?: number;
}) {
  return (
    <IconFlag
      size={size}
      color={PRIORITY_COLOR[priority]}
      fill={priority < 4 ? PRIORITY_COLOR[priority] : 'none'}
    />
  );
}

export function PriorityPicker({
  value,
  onChange,
  compact = true,
  children,
}: {
  value: number;
  onChange: (priority: 1 | 2 | 3 | 4) => void;
  compact?: boolean;
  /** Replaces the default chip. */
  children?: ReactNode;
}) {
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        {children ? (
          <Box>{children}</Box>
        ) : (
          <Button
            size={compact ? 'compact-sm' : 'sm'}
            variant="default"
            fw={400}
            c={value < 4 ? PRIORITY_COLOR[value] : 'dimmed'}
            leftSection={<PriorityFlag priority={value} size={14} />}
          >
            {value < 4 ? `P${value}` : 'Priority'}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {[1, 2, 3, 4].map((p) => (
          <Menu.Item
            key={p}
            leftSection={<PriorityFlag priority={p} />}
            onClick={() => onChange(p as 1 | 2 | 3 | 4)}
            fw={value === p ? 600 : undefined}
          >
            Priority {p}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function ProjectIcon({
  project,
  size = 14,
}: {
  project?: { isInbox?: boolean; color: string };
  size?: number;
}) {
  return project?.isInbox ? (
    <IconInbox size={size} />
  ) : (
    <IconHash size={size} color={colorOf(project?.color ?? 'charcoal')} />
  );
}

/**
 * Where a task goes: Inbox or one of your projects. A plain button with the
 * project's name, as in Todoist, that opens a list you can type in.
 */
export function ProjectPicker({
  value,
  onChange,
  children,
}: {
  value: number | null;
  onChange: (projectId: number) => void;
  /** Replaces the default button. */
  children?: ReactNode;
}) {
  const projects = usePage<SharedProps>().props.sidebar?.projects ?? [];
  const current =
    projects.find((p) => p.id === value) ?? projects.find((p) => p.isInbox);
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => setSearch(''),
    onDropdownOpen: () => combobox.focusSearchInput(),
  });
  const shown = projects.filter((p) =>
    (p.isInbox ? 'Inbox' : p.name)
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );

  return (
    <Combobox
      store={combobox}
      width={240}
      position="bottom-start"
      withinPortal
      onOptionSubmit={(id) => {
        onChange(Number(id));
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target targetType="button">
        {children ? (
          <Box onClick={() => combobox.toggleDropdown()}>{children}</Box>
        ) : (
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            fw={500}
            c="var(--mantine-color-text)"
            leftSection={<ProjectIcon project={current} />}
            rightSection={<IconChevronDown size={12} />}
            onClick={() => combobox.toggleDropdown()}
          >
            {current?.isInbox ? 'Inbox' : current?.name}
          </Button>
        )}
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Type a project name"
        />
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="scroll">
            {shown.map((p) => (
              <Combobox.Option value={String(p.id)} key={p.id}>
                <Group gap={8} wrap="nowrap">
                  <ProjectIcon project={p} />
                  <Text size="sm" style={{ flex: 1 }} truncate>
                    {p.isInbox ? 'Inbox' : p.name}
                  </Text>
                  {p.id === current?.id && (
                    <IconCheck
                      size={14}
                      color="var(--mantine-color-tomato-6)"
                    />
                  )}
                </Group>
              </Combobox.Option>
            ))}
            {shown.length === 0 && (
              <Combobox.Empty>No project by that name</Combobox.Empty>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

/**
 * Labels, Todoist style: a chip that opens your labels with a tick box
 * each. Typing a name that doesn't exist yet offers to create it.
 */
export function LabelsPicker({
  value,
  onChange,
  children,
}: {
  value: string[];
  onChange: (labels: string[]) => void;
  /** Replaces the default chip. */
  children?: ReactNode;
}) {
  const labels = usePage<SharedProps>().props.sidebar?.labels ?? [];
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => setSearch(''),
    onDropdownOpen: () => combobox.focusSearchInput(),
  });
  const query = search.trim().toLowerCase();
  const names = [
    ...labels.map((l) => l.name),
    ...value.filter((v) => !labels.some((l) => l.name === v)),
  ];
  const shown = names.filter((n) => n.toLowerCase().includes(query));
  const color = (name: string) =>
    colorOf(labels.find((l) => l.name === name)?.color ?? 'charcoal');
  const toggle = (name: string) =>
    onChange(
      value.includes(name) ? value.filter((v) => v !== name) : [...value, name],
    );

  return (
    <Combobox
      store={combobox}
      width={240}
      position="bottom-start"
      withinPortal
      onOptionSubmit={(name) => {
        toggle(name);
        setSearch('');
      }}
    >
      <Combobox.Target targetType="button">
        {children ? (
          <Box onClick={() => combobox.toggleDropdown()}>{children}</Box>
        ) : (
          <Button
            size="compact-sm"
            variant="default"
            fw={400}
            c={value.length ? 'var(--mantine-color-text)' : 'dimmed'}
            leftSection={<IconTag size={14} />}
            onClick={() => combobox.toggleDropdown()}
          >
            {value.length ? value.join(', ') : 'Labels'}
          </Button>
        )}
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Type a label"
        />
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="scroll">
            {shown.map((name) => (
              <Combobox.Option value={name} key={name}>
                <Group gap={8} wrap="nowrap">
                  <IconTag size={14} color={color(name)} />
                  <Text size="sm" style={{ flex: 1 }} truncate>
                    {name}
                  </Text>
                  <Checkbox
                    size="xs"
                    checked={value.includes(name)}
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                  />
                </Group>
              </Combobox.Option>
            ))}
            {query && !names.some((n) => n.toLowerCase() === query) && (
              <Combobox.Option value={search.trim()}>
                <Group gap={8} wrap="nowrap">
                  <IconPlus size={14} />
                  <Text size="sm">Create “{search.trim()}”</Text>
                </Group>
              </Combobox.Option>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

export function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <ActionIcon
      size="xs"
      variant="subtle"
      color="gray"
      onClick={onClick}
      aria-label="Clear"
    >
      <IconX size={12} />
    </ActionIcon>
  );
}
