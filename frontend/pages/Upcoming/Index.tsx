import { Box, Button, Group, Loader, Popover, Text } from '@mantine/core';
import { DatePicker, MiniCalendar } from '@mantine/dates';
import { IconChevronDown } from '@tabler/icons-react';
import { InfiniteScroll, router, usePage } from 'nestjs-mvc/react';
import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/Illustration';
import { PageHeader } from '../../components/PageHeader';
import { TaskList } from '../../components/TaskList';
import { addDays, dayHeading, daysBetween } from '../../lib/format';
import { setPageDefaults } from '../../lib/quickAdd';
import { setTaskOrder } from '../../lib/tasks';
import { appLayout } from '../../layouts/AppLayout';
import type { DetailProps, SharedProps, TaskRow } from '../../types';

interface Props extends DetailProps {
  overdue: TaskRow[];
  days: { data: { date: string; tasks: TaskRow[] }[] };
}

const dayId = (date: string) => `day-${date}`;

/**
 * Upcoming: every day from today on, as far as you scroll. `days` is a
 * `scroll()` prop, a week per page; InfiniteScroll asks for the next week
 * as the end comes into view and adds it underneath. The strip on top
 * jumps to a day: straight there if it's loaded, otherwise a visit to the
 * week it's in (`?page=n`), from where scrolling up loads what's before.
 */
export default function Upcoming({ overdue, days }: Props) {
  const { today } = usePage<SharedProps>().props;
  const [start, setStart] = useState(today);
  const [picker, setPicker] = useState(false);
  useEffect(() => setPageDefaults({ dueDate: addDays(today, 1) }), [today]);
  setTaskOrder(
    [...overdue, ...days.data.flatMap((d) => d.tasks)].map((t) => t.id),
  );

  function jump(date: string) {
    setStart(date);
    const element = document.getElementById(dayId(date));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const week = Math.max(0, Math.floor(daysBetween(today, date) / 7));
    router.get('/upcoming', { page: week }, { preserveState: false });
  }

  const month = new Date(`${start}T12:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader title="Upcoming" />
      <Box className="upcoming-strip" mb="sm">
        <Group justify="space-between" mb={6}>
          <Popover opened={picker} onChange={setPicker} position="bottom-start">
            <Popover.Target>
              <Button
                variant="subtle"
                color="gray"
                size="compact-md"
                rightSection={<IconChevronDown size={14} />}
                onClick={() => setPicker((o) => !o)}
              >
                {month}
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <DatePicker
                value={start}
                minDate={today}
                firstDayOfWeek={1}
                onChange={(date) => {
                  setPicker(false);
                  if (date) jump(date);
                }}
              />
            </Popover.Dropdown>
          </Popover>
          <Button
            variant="default"
            size="compact-sm"
            onClick={() => jump(today)}
          >
            Today
          </Button>
        </Group>
        <MiniCalendar
          date={start}
          onDateChange={setStart}
          value={start}
          onChange={jump}
          minDate={today}
          numberOfDays={7}
          getDayProps={(date) =>
            date === today
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

      {overdue.length > 0 && (
        <Box mb="md" data-xray="overdue">
          <Text fw={700} size="sm" className="section-title">
            Overdue
          </Text>
          <TaskList tasks={overdue} showProject add={false} />
        </Box>
      )}

      <div data-xray="days">
        <InfiniteScroll
          data="days"
          buffer={600}
          loading={
            <Group justify="center" p="md">
              <Loader size="sm" />
            </Group>
          }
        >
          {days.data.map((day) => (
            <Box
              key={day.date}
              id={dayId(day.date)}
              mb="sm"
              style={{ scrollMarginTop: 16 }}
            >
              <Text fw={700} size="sm" className="section-title">
                {dayHeading(day.date, today)}
              </Text>
              <TaskList
                tasks={day.tasks}
                showProject
                showDate={false}
                add={{ dueDate: day.date }}
                empty={
                  day.date === today && (
                    <EmptyState
                      illustration="relaxing-at-home"
                      title="Nothing today"
                      width={120}
                    >
                      A rare sight. Treasure it.
                    </EmptyState>
                  )
                }
              />
            </Box>
          ))}
        </InfiniteScroll>
      </div>
    </>
  );
}

Upcoming.layout = appLayout;
