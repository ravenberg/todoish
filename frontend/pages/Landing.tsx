import {
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBolt,
  IconDeviceMobile,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { Head, Link } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '../components/Logo';
import { Providers } from '../components/Providers';

const FEATURES: [ReactNode, string, string][] = [
  [
    <IconSparkles size={20} />,
    'Quick add that gets it',
    '“Pay rent every month p2 #Home” becomes a task with a date, a priority and a project. You watch it happen as you type.',
  ],
  [
    <IconBolt size={20} />,
    'Fast, somehow',
    'Ticking a task off is instant. Pages load before you click them. The server still makes every decision.',
  ],
  [
    <IconUsers size={20} />,
    'Share a project',
    'Send a link, and whoever opens it is in. Their changes show up on your screen while you look at it.',
  ],
  [
    <IconDeviceMobile size={20} />,
    'On your phone too',
    'Add it to your home screen. It has tabs, a big red plus and sheets that slide up, like an app would.',
  ],
];

/**
 * The front page, rendered on the server (@Ssr() on its route): what search
 * engines, link previews and a slow phone see first. Logged in, you never
 * see it; the controller sends you to Today.
 */
export default function Landing() {
  return (
    <Providers>
      <Head title="Todoish · Like Todoist, but ish" />
      <Box className="guest" mih="100dvh">
        <Container size="lg" py="md">
          <Group justify="space-between">
            <Logo size={30} />
            <Group gap="xs">
              <Button
                component={Link}
                href="/login"
                variant="subtle"
                color="gray"
              >
                Log in
              </Button>
              <Button component={Link} href="/register">
                Start for free
              </Button>
            </Group>
          </Group>
        </Container>

        <Container size="md" pt={80} pb={60}>
          <Stack align="center" ta="center" gap="lg">
            <LogoMark size={72} />
            <Title className="hero-title">
              Organize your work and life,{' '}
              <Text span inherit c="tomato.6">
                ish
              </Text>
              .
            </Title>
            <Text size="lg" c="dimmed" maw={560}>
              Todoish is a to-do app that looks a lot like Todoist, because it
              is a demo of{' '}
              <Anchor href="https://nestjs-mvc.ravenberg.dev">
                nestjs-mvc
              </Anchor>
              : NestJS controllers that return React pages. Every screen here is
              a controller and a component, and nothing else.
            </Text>
            <Group>
              <Button size="lg" component={Link} href="/login">
                Try the demo
              </Button>
              <Button
                size="lg"
                variant="default"
                component="a"
                href="https://github.com/ravenberg/todoish"
              >
                Read the code
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              Log in as ada@todoish.dev with password <code>password</code>.
              Everything resets at night.
            </Text>
          </Stack>
        </Container>

        <Container size="lg" pb={100}>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {FEATURES.map(([icon, title, body]) => (
              <Paper key={title} p="lg" radius="lg" withBorder>
                <ThemeIcon variant="light" size="lg" radius="md" mb="sm">
                  {icon}
                </ThemeIcon>
                <Text fw={700} mb={4}>
                  {title}
                </Text>
                <Text size="sm" c="dimmed">
                  {body}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Text size="xs" c="dimmed" ta="center" mt={60}>
            Not affiliated with Todoist, which is the real thing and very good.
            Press Shift+X anywhere in the app to see how a page is built.
          </Text>
        </Container>
      </Box>
    </Providers>
  );
}
