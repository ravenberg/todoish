import { Anchor, Box, Center, Container, Stack, Text } from '@mantine/core';
import { Link } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { Providers } from '../components/Providers';

/** Login, sign-up and invitations: the logo, a card, and a way home. */
export function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Center mih="100dvh" className="guest" py="xl">
        <Container size={440} w="100%">
          <Stack align="center" mb="xl">
            <Anchor component={Link} href="/" underline="never">
              <Logo size={34} />
            </Anchor>
          </Stack>
          {children}
          <Box mt="xl">
            <Text size="xs" c="dimmed" ta="center">
              A demo app for{' '}
              <Anchor href="https://nestjs-mvc.ravenberg.dev" size="xs">
                nestjs-mvc
              </Anchor>
              . Not affiliated with Todoist, which is the real thing.
            </Text>
          </Box>
        </Container>
      </Center>
    </Providers>
  );
}

export const guestLayout = (page: ReactNode) => (
  <GuestLayout>{page}</GuestLayout>
);
