import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  RingProgress,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Tabs,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { AreaChart, BarChart } from '@mantine/charts';
import { useDisclosure } from '@mantine/hooks';
import { IconFlame, IconZzz, IconTrophy } from '@tabler/icons-react';
import { Deferred, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';

interface Goals {
  dailyGoal: number;
  weeklyGoal: number;
  daysOff: number[];
  vacation: boolean;
}

interface Props {
  goals: Goals;
  daily?: {
    done: number;
    goal: number;
    streak: { current: number; longest: number };
    week: { day: string; count: number }[];
  };
  weekly?: {
    done: number;
    goal: number;
    weeks: { week: string; count: number }[];
    streak: number;
  };
  karma?: {
    karma: number;
    level: {
      name: string;
      next: { name: string; from: number; left: number } | null;
    };
    trend: { day: string; karma: number }[];
  };
}

const short = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00`).toLocaleDateString('en-GB', options);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Block({ children }: { children: React.ReactNode }) {
  return (
    <Paper withBorder radius="lg" p="lg">
      {children}
    </Paper>
  );
}

const Loading = () => (
  <Block>
    <Skeleton h={20} w="40%" mb="md" />
    <Skeleton h={140} />
  </Block>
);

/**
 * Goals, checked as you go: each field asks the server's own schema
 * (Precognition), which knows, for example, that a weekly goal can't be
 * less than a daily one.
 */
function GoalsForm({
  goals,
  opened,
  onClose,
}: {
  goals: Goals;
  opened: boolean;
  onClose: () => void;
}) {
  const form = useForm('put', '/productivity/goals', goals);
  function submit(event: FormEvent) {
    event.preventDefault();
    form.submit({ onSuccess: onClose, preserveScroll: true });
  }
  return (
    <Modal opened={opened} onClose={onClose} title="Goals" size="sm">
      <form onSubmit={submit}>
        <Stack>
          <NumberInput
            label="Daily goal"
            description="Tasks that make a good day"
            value={form.data.dailyGoal}
            onChange={(v) => form.setData('dailyGoal', Number(v))}
            onBlur={() => form.validate('dailyGoal')}
            error={form.invalid('dailyGoal') && form.errors.dailyGoal}
          />
          <NumberInput
            label="Weekly goal"
            value={form.data.weeklyGoal}
            onChange={(v) => form.setData('weeklyGoal', Number(v))}
            onBlur={() => form.validate('weeklyGoal')}
            error={form.invalid('weeklyGoal') && form.errors.weeklyGoal}
          />
          <Checkbox.Group
            label="Days off"
            description="They don’t break your streak"
            value={form.data.daysOff.map(String)}
            onChange={(v) => form.setData('daysOff', v.map(Number))}
            error={form.errors.daysOff}
          >
            <Group gap="xs" mt={6}>
              {WEEKDAYS.map((name, i) => (
                <Checkbox key={name} value={String(i)} label={name} />
              ))}
            </Group>
          </Checkbox.Group>
          <Switch
            label="Vacation mode"
            description="Streaks stand still while you’re away"
            checked={form.data.vacation}
            onChange={(e) => form.setData('vacation', e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={form.processing}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/**
 * The page paints straight away with your goals. Daily, weekly and karma
 * each come in their own deferred group, three requests in parallel, so a
 * slow one doesn't hold up the others. Karma is `rescue`d: if it fails, it
 * says so here and the rest of the page is fine.
 */
export default function Index({ goals, daily, weekly, karma }: Props) {
  const [opened, form] = useDisclosure(false);

  return (
    <>
      <PageHeader
        title="Productivity"
        actions={
          <Button variant="default" size="compact-md" onClick={form.open}>
            Edit goals
          </Button>
        }
      />
      <Tabs defaultValue="daily" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="daily">Daily</Tabs.Tab>
          <Tabs.Tab value="weekly">Weekly</Tabs.Tab>
          <Tabs.Tab value="karma">Karma</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="daily">
          <Deferred data="daily" fallback={<Loading />}>
            {daily && (
              <Stack data-xray="daily">
                <Block>
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" c="dimmed">
                        Daily goal
                      </Text>
                      <Text fz={32} fw={800}>
                        {daily.done}/{daily.goal} tasks
                      </Text>
                      <Text size="sm" c="dimmed">
                        {daily.done >= daily.goal
                          ? 'Goal reached. Take the rest of the day, ish.'
                          : 'One task at a time.'}
                      </Text>
                    </div>
                    <RingProgress
                      size={110}
                      thickness={10}
                      roundCaps
                      sections={[
                        {
                          value: Math.min(100, (daily.done / daily.goal) * 100),
                          color: 'tomato',
                        },
                      ]}
                      label={
                        <Group justify="center">
                          <IconTrophy
                            size={28}
                            color="var(--mantine-color-tomato-6)"
                          />
                        </Group>
                      }
                    />
                  </Group>
                </Block>
                <SimpleGrid cols={2}>
                  <Block>
                    <Group gap={6}>
                      <IconFlame size={18} color="#eb8909" />
                      <Text size="sm" c="dimmed">
                        Streak
                      </Text>
                    </Group>
                    <Text fz={26} fw={800}>
                      {daily.streak.current} days
                    </Text>
                  </Block>
                  <Block>
                    <Text size="sm" c="dimmed">
                      Longest streak
                    </Text>
                    <Text fz={26} fw={800}>
                      {daily.streak.longest} days
                    </Text>
                  </Block>
                </SimpleGrid>
                <Block>
                  <Text size="sm" fw={600} mb="sm">
                    The last seven days
                  </Text>
                  <BarChart
                    h={180}
                    data={daily.week.map((d) => ({
                      day: short(d.day, { weekday: 'short' }),
                      Completed: d.count,
                    }))}
                    dataKey="day"
                    series={[{ name: 'Completed', color: 'tomato.6' }]}
                    referenceLines={[
                      { y: daily.goal, label: 'Goal', color: 'gray.5' },
                    ]}
                    tickLine="none"
                    gridAxis="y"
                  />
                </Block>
              </Stack>
            )}
          </Deferred>
        </Tabs.Panel>

        <Tabs.Panel value="weekly">
          <Deferred data="weekly" fallback={<Loading />}>
            {weekly && (
              <Stack data-xray="weekly">
                <Block>
                  <Text size="sm" c="dimmed">
                    This week
                  </Text>
                  <Text fz={32} fw={800}>
                    {weekly.done}/{weekly.goal} tasks
                  </Text>
                  <Text size="sm" c="dimmed">
                    {weekly.streak} week streak
                  </Text>
                </Block>
                <Block>
                  <Text size="sm" fw={600} mb="sm">
                    The last four weeks
                  </Text>
                  <BarChart
                    h={200}
                    data={weekly.weeks.map((w) => ({
                      week: short(w.week, { day: 'numeric', month: 'short' }),
                      Completed: w.count,
                    }))}
                    dataKey="week"
                    series={[{ name: 'Completed', color: 'tomato.6' }]}
                    referenceLines={[
                      { y: weekly.goal, label: 'Goal', color: 'gray.5' },
                    ]}
                    tickLine="none"
                    gridAxis="y"
                  />
                </Block>
              </Stack>
            )}
          </Deferred>
        </Tabs.Panel>

        <Tabs.Panel value="karma">
          <Deferred
            data="karma"
            fallback={<Loading />}
            rescue={
              <Alert
                color="gray"
                icon={<IconZzz />}
                title="Karma is taking a nap"
              >
                It couldn’t be worked out just now. The rest of the page loaded
                fine, which is the point of <code>rescue</code>.
              </Alert>
            }
          >
            {karma && (
              <Stack data-xray="karma">
                <Block>
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" c="dimmed">
                        Karma
                      </Text>
                      <Text fz={32} fw={800}>
                        {karma.level.name} (
                        {karma.karma.toLocaleString('en-GB')})
                      </Text>
                      {karma.level.next && (
                        <Text size="sm" c="dimmed">
                          {karma.level.next.left.toLocaleString('en-GB')} to go
                          until {karma.level.next.name}
                        </Text>
                      )}
                    </div>
                    <ThemeIcon size={64} radius="xl" variant="light">
                      <IconTrophy size={34} />
                    </ThemeIcon>
                  </Group>
                </Block>
                <Block>
                  <Text size="sm" fw={600} mb="sm">
                    Karma trend
                  </Text>
                  <AreaChart
                    h={200}
                    data={karma.trend.map((t) => ({
                      day: short(t.day, { day: 'numeric', month: 'short' }),
                      Karma: t.karma,
                    }))}
                    dataKey="day"
                    series={[{ name: 'Karma', color: 'tomato.6' }]}
                    curveType="monotone"
                    tickLine="none"
                    gridAxis="y"
                    withDots={false}
                  />
                </Block>
              </Stack>
            )}
          </Deferred>
        </Tabs.Panel>
      </Tabs>
      <Box h="md" />
      <GoalsForm
        key={JSON.stringify(goals)}
        goals={goals}
        opened={opened}
        onClose={form.close}
      />
    </>
  );
}

Index.layout = appLayout;
