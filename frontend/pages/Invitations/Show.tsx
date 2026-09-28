import {
  Avatar,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconHash } from '@tabler/icons-react';
import { Head, Link, useForm, usePage } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { colorOf } from '../../lib/colors';
import { firstName, initials } from '../../lib/format';
import { guestLayout } from '../../layouts/GuestLayout';
import type { SharedProps } from '../../types';

interface Props {
  project: { id: number; name: string; color: string };
  invitedBy: { id: number; name: string };
  people: { id: number; name: string }[];
  openTasks: number;
  alreadyMember: boolean;
  action: string;
}

/**
 * Where an invitation link lands. Rendered on the server: it's the link
 * people paste into a chat, so the first paint comes with the HTML. Logged
 * in, you join with one click; otherwise you sign up right here.
 */
export default function Show({
  project,
  invitedBy,
  people,
  openTasks,
  alreadyMember,
  action,
}: Props) {
  const user = usePage<SharedProps>().props.auth.user;
  const form = useForm({ name: '', email: '', password: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post(action);
  }

  return (
    <Paper withBorder shadow="sm" p="xl" radius="lg">
      <Head title={`Join ${project.name} · Todoish`} />
      <Stack align="center" ta="center" gap="xs" mb="lg">
        <Avatar.Group>
          {people.slice(0, 5).map((p) => (
            <Avatar key={p.id} radius="xl" color="initials" name={p.name}>
              {initials(p.name)}
            </Avatar>
          ))}
        </Avatar.Group>
        <Text size="sm" c="dimmed">
          {firstName(invitedBy.name)} invited you to
        </Text>
        <Group gap={6} justify="center">
          <IconHash size={22} color={colorOf(project.color)} />
          <Title order={2}>{project.name}</Title>
        </Group>
        <Text size="sm" c="dimmed">
          {people.length} {people.length === 1 ? 'person' : 'people'} ·{' '}
          {openTasks} open task{openTasks === 1 ? '' : 's'}
        </Text>
      </Stack>

      {alreadyMember ? (
        <Button component={Link} href={`/projects/${project.id}`} fullWidth>
          You’re already in. Open it
        </Button>
      ) : user ? (
        <Button
          fullWidth
          loading={form.processing}
          onClick={() => form.post(action)}
        >
          Join as {firstName(user.name)}
        </Button>
      ) : (
        <form onSubmit={submit}>
          <Stack>
            <Text size="sm" fw={600}>
              Make an account to join
            </Text>
            <TextInput
              label="Name"
              value={form.data.name}
              onChange={(e) => form.setData('name', e.currentTarget.value)}
              error={form.errors.name}
            />
            <TextInput
              label="Email"
              type="email"
              value={form.data.email}
              onChange={(e) => form.setData('email', e.currentTarget.value)}
              error={form.errors.email}
            />
            <PasswordInput
              label="Password"
              value={form.data.password}
              onChange={(e) => form.setData('password', e.currentTarget.value)}
              error={form.errors.password}
            />
            <Button type="submit" loading={form.processing} fullWidth>
              Sign up and join
            </Button>
            <Text size="sm" c="dimmed" ta="center">
              Have an account?{' '}
              <Text component={Link} href="/login" c="tomato.6" size="sm">
                Log in first
              </Text>
              , then open the link again.
            </Text>
          </Stack>
        </form>
      )}
    </Paper>
  );
}

Show.layout = guestLayout;
