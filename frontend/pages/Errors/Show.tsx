import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Head, Link } from 'nestjs-mvc/react';
import {
  Illustration,
  type IllustrationName,
} from '../../components/Illustration';
import { appLayout } from '../../layouts/AppLayout';

const PICTURES: Record<number, IllustrationName> = {
  403: 'access-denied',
  404: 'page-not-found',
};

const TITLES: Record<number, string> = {
  403: 'Not yours, ish',
  404: 'Nothing here',
  500: 'Something broke',
  503: 'Back soon',
};

export default function Show({
  status,
  reason,
}: {
  status: number;
  reason?: string;
}) {
  return (
    <Center mih="60vh">
      <Head title={`${status} · Todoish`} />
      <Stack align="center" gap="xs" ta="center">
        <Illustration name={PICTURES[status] ?? 'fixing-bugs'} width={240} />
        <Text size="sm" c="dimmed" mt="lg">
          Error {status}
        </Text>
        <Title order={3}>{TITLES[status] ?? 'Error'}</Title>
        {reason && <Text c="dimmed">{reason}</Text>}
        <Button component={Link} href="/today" variant="default" mt="md">
          Back to Today
        </Button>
      </Stack>
    </Center>
  );
}

Show.layout = appLayout;
