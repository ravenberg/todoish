import {
  Anchor,
  Button,
  Code,
  CopyButton,
  Group,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconCheck,
  IconCopy,
  IconPalette,
  IconPlugConnected,
  IconUserCircle,
} from '@tabler/icons-react';
import { router, useForm, useRemember } from 'nestjs-mvc/react';
import type { FormEvent, ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { appLayout } from '../../layouts/AppLayout';

interface Props {
  profile: { name: string; email: string };
  privacy: { encryptHistory: boolean };
  integrations: { calendarUrl: string; inboxAddress: string; hookUrl: string };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Title order={4} mb="md">
        {title}
      </Title>
      {children}
    </Paper>
  );
}

function Copyable({ value }: { value: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput
        value={value}
        readOnly
        style={{ flex: 1 }}
        ff="monospace"
        size="xs"
      />
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button
            size="xs"
            variant="default"
            onClick={copy}
            leftSection={
              copied ? <IconCheck size={14} /> : <IconCopy size={14} />
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

/**
 * Two forms on one page: profile and password. Each posts with its own
 * error bag ("profile", "password"), so a wrong current password never
 * lights up the email field, and the other way round.
 */
function Account({ profile }: Pick<Props, 'profile'>) {
  const details = useForm(profile);
  const password = useForm({ current: '', password: '' });

  function saveDetails(event: FormEvent) {
    event.preventDefault();
    details.put('/settings/profile', {
      errorBag: 'profile',
      preserveScroll: true,
    });
  }
  function savePassword(event: FormEvent) {
    event.preventDefault();
    password.put('/settings/password', {
      errorBag: 'password',
      preserveScroll: true,
      onSuccess: () => password.reset(),
    });
  }

  return (
    <Stack>
      <Card title="Profile">
        <form onSubmit={saveDetails}>
          <Stack>
            <TextInput
              label="Name"
              value={details.data.name}
              onChange={(e) => details.setData('name', e.currentTarget.value)}
              error={details.errors.name}
            />
            <TextInput
              label="Email"
              value={details.data.email}
              onChange={(e) => details.setData('email', e.currentTarget.value)}
              error={details.errors.email}
            />
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={details.processing}
                disabled={!details.isDirty}
              >
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
      <Card title="Password">
        <form onSubmit={savePassword}>
          <Stack>
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              value={password.data.current}
              onChange={(e) =>
                password.setData('current', e.currentTarget.value)
              }
              error={password.errors.current}
            />
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              value={password.data.password}
              onChange={(e) =>
                password.setData('password', e.currentTarget.value)
              }
              error={password.errors.password}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={password.processing}>
                Change password
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}

function Integrations({ integrations }: Pick<Props, 'integrations'>) {
  return (
    <Stack>
      <Card title="Calendar feed">
        <Text size="sm" c="dimmed" mb="sm">
          Subscribe to this in Google Calendar, Apple Calendar or Outlook and
          your tasks with a date show up there. The link is signed, so it works
          without logging in. Keep it to yourself; if it leaks, reset it.
        </Text>
        <Copyable value={integrations.calendarUrl} />
        <Group mt="sm" gap="xs">
          <Button
            size="xs"
            variant="default"
            component="a"
            href={integrations.calendarUrl.replace(/^https?:/, 'webcal:')}
          >
            Open in calendar app
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() =>
              router.post(
                '/settings/calendar/reset',
                {},
                { preserveScroll: true },
              )
            }
          >
            Reset link
          </Button>
        </Group>
      </Card>
      <Card title="Email to Inbox">
        <Text size="sm" c="dimmed" mb="sm">
          Forward an email to this address and it becomes a task in your Inbox.
          The subject is read like quick add: “Call the bank tomorrow p1”
          arrives with a date and a priority.
        </Text>
        <Copyable value={integrations.inboxAddress} />
        <Text size="sm" c="dimmed" mt="md" mb={4}>
          There’s no mail server in the demo; your mail provider would post to
          this webhook. Try it yourself:
        </Text>
        <Code block fz="xs">
          {`curl -X POST ${integrations.hookUrl} \\\n  -H 'Content-Type: application/json' \\\n  -d '{"subject": "Call the bank tomorrow p1"}'`}
        </Code>
        <Text size="xs" c="dimmed" mt={6}>
          Or run <Code fz="xs">npm run email:demo</Code>.
        </Text>
        <Button
          mt="sm"
          size="xs"
          variant="subtle"
          color="red"
          onClick={() =>
            router.post('/settings/inbox/reset', {}, { preserveScroll: true })
          }
        >
          Reset address
        </Button>
      </Card>
    </Stack>
  );
}

function Privacy({ privacy }: Pick<Props, 'privacy'>) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Stack>
      <Card title="Theme">
        <SegmentedControl
          value={colorScheme}
          onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
          data={[
            { value: 'auto', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>
      <Card title="Shared computer">
        <Switch
          checked={privacy.encryptHistory}
          onChange={(e) =>
            router.put(
              '/settings/privacy',
              { encryptHistory: e.currentTarget.checked },
              { preserveScroll: true },
            )
          }
          label="Encrypt history"
          description="Pages you visit are stored encrypted in the browser’s history. After you log out, the back button shows nothing. Handy on a library computer."
        />
        <Text size="xs" c="dimmed" mt="sm">
          Uses nestjs-mvc’s{' '}
          <Anchor
            href="https://nestjs-mvc.ravenberg.dev/docs/history-encryption"
            size="xs"
          >
            history encryption
          </Anchor>
          .
        </Text>
      </Card>
    </Stack>
  );
}

export default function Index({ profile, privacy, integrations }: Props) {
  // The open tab survives going back and forward (useRemember).
  const [tab, setTab] = useRemember<string | null>('account', 'settings-tab');
  const phone = useMediaQuery('(max-width: 48em)');
  return (
    <>
      <PageHeader title="Settings" />
      {/* Todoist's settings: the sections down the left, the page beside. */}
      <Tabs
        value={tab}
        onChange={setTab}
        orientation={phone ? 'horizontal' : 'vertical'}
        variant="pills"
        classNames={{ list: 'settings-nav', tab: 'settings-tab' }}
      >
        <Tabs.List mb={phone ? 'md' : 0}>
          <Tabs.Tab value="account" leftSection={<IconUserCircle size={18} />}>
            Account
          </Tabs.Tab>
          <Tabs.Tab
            value="integrations"
            leftSection={<IconPlugConnected size={18} />}
          >
            Integrations
          </Tabs.Tab>
          <Tabs.Tab value="privacy" leftSection={<IconPalette size={18} />}>
            Privacy & theme
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="account" pl={phone ? 0 : 'lg'}>
          <Account profile={profile} />
        </Tabs.Panel>
        <Tabs.Panel value="integrations" pl={phone ? 0 : 'lg'}>
          <Integrations integrations={integrations} />
        </Tabs.Panel>
        <Tabs.Panel value="privacy" pl={phone ? 0 : 'lg'}>
          <Privacy privacy={privacy} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

Index.layout = appLayout;
