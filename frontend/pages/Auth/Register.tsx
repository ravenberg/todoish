import {
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { Head, Link, useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { guestLayout } from '../../layouts/GuestLayout';

/**
 * Sign up, checked as you go: leaving a field asks the server's own
 * validation (Precognition) about it, including whether the email is taken.
 * The handler doesn't run until you press the button.
 */
export default function Register() {
  const form = useForm('post', '/register', {
    name: '',
    email: '',
    password: '',
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.submit();
  }

  const ok = (field: 'name' | 'email' | 'password') =>
    form.valid(field) ? (
      <IconCheck size={16} color="var(--mantine-color-green-6)" />
    ) : null;

  return (
    <Paper withBorder shadow="sm" p="xl" radius="lg">
      <Head title="Sign up · Todoish" />
      <Title order={3} mb={4}>
        Get organised, ish
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Free forever, which in demo terms means until tonight’s reset.
      </Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Name"
            autoComplete="name"
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            onBlur={() => form.validate('name')}
            error={form.invalid('name') && form.errors.name}
            rightSection={ok('name')}
          />
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.currentTarget.value)}
            onBlur={() => form.validate('email')}
            error={form.invalid('email') && form.errors.email}
            description={form.validating ? 'Checking…' : undefined}
            rightSection={ok('email')}
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.currentTarget.value)}
            onBlur={() => form.validate('password')}
            error={form.invalid('password') && form.errors.password}
          />
          <Button type="submit" loading={form.processing} fullWidth>
            Sign up
          </Button>
        </Stack>
      </form>
      <Text size="sm" ta="center" mt="md">
        Already have an account?{' '}
        <Anchor component={Link} href="/login">
          Log in
        </Anchor>
      </Text>
    </Paper>
  );
}

Register.layout = guestLayout;
