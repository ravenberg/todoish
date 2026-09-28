import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Popover,
  Select,
  Stack,
  TagsInput,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { DatePicker, TimeInput } from '@mantine/dates';
import {
  IconArmchair,
  IconArrowRight,
  IconBan,
  IconCalendarEvent,
  IconFlag,
  IconHash,
  IconInbox,
  IconRepeat,
  IconSun,
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
}: {
  value: number;
  onChange: (priority: 1 | 2 | 3 | 4) => void;
  compact?: boolean;
}) {
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Button
          size={compact ? 'compact-sm' : 'sm'}
          variant="default"
          fw={400}
          c={value < 4 ? PRIORITY_COLOR[value] : 'dimmed'}
          leftSection={<PriorityFlag priority={value} size={14} />}
        >
          {value < 4 ? `P${value}` : 'Priority'}
        </Button>
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

/** Where a task goes: Inbox or one of your projects. */
export function ProjectPicker({
  value,
  onChange,
  size = 'xs',
  variant = 'filled',
}: {
  value: number | null;
  onChange: (projectId: number) => void;
  size?: 'xs' | 'sm';
  variant?: 'filled' | 'unstyled' | 'default';
}) {
  const projects = usePage<SharedProps>().props.sidebar?.projects ?? [];
  const current =
    projects.find((p) => p.id === value) ?? projects.find((p) => p.isInbox);
  return (
    <Select
      size={size}
      variant={variant}
      w={180}
      aria-label="Project"
      value={current ? String(current.id) : null}
      allowDeselect={false}
      searchable
      comboboxProps={{ withinPortal: true, width: 220 }}
      leftSection={
        current?.isInbox ? (
          <IconInbox size={14} />
        ) : (
          <IconHash size={14} color={colorOf(current?.color ?? 'charcoal')} />
        )
      }
      data={projects.map((p) => ({
        value: String(p.id),
        label: p.isInbox ? 'Inbox' : p.name,
      }))}
      onChange={(id) => id && onChange(Number(id))}
    />
  );
}

/** Your labels, and new ones as you type them. */
export function LabelsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (labels: string[]) => void;
}) {
  const labels = usePage<SharedProps>().props.sidebar?.labels ?? [];
  return (
    <TagsInput
      size="xs"
      placeholder={value.length ? '' : 'Add a label'}
      data={labels.map((l) => l.name)}
      value={value}
      onChange={onChange}
      clearable
      comboboxProps={{ withinPortal: true }}
      aria-label="Labels"
    />
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
