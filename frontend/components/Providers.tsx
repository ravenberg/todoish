import { Anchor, Button, Group, MantineProvider, Text } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { Link, usePage } from 'nestjs-mvc/react';
import { type ReactNode, useEffect } from 'react';
import { reopenTask } from '../lib/tasks';
import { theme } from '../lib/theme';
import { XrayOverlay, XrayShortcut } from '../xray/XrayOverlay';

interface Flash {
  success?: string;
  error?: string;
  /** From completing a task: what to undo. */
  completed?: { id: number; title: string; next: string | null };
  /** From adding one: where it went. */
  added?: { id: number; title: string; project: string; projectId: number };
}

/**
 * Shows each flash message once, as a toast. Completing a task comes with
 * Undo, like in Todoist: the flash carries the task's id to reopen.
 */
function FlashToasts() {
  const flash = usePage().flash as Flash | undefined;
  useEffect(() => {
    if (!flash) return;
    if (flash.success) notifications.show({ message: flash.success });
    if (flash.error) notifications.show({ message: flash.error, color: 'red' });
    if (flash.completed) {
      const { id, title, next } = flash.completed;
      const toast = `completed-${id}-${Date.now()}`;
      notifications.show({
        id: toast,
        message: (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm" truncate>
              {next
                ? `“${title}” is back on its next date.`
                : '1 task completed'}
            </Text>
            {!next && (
              <Button
                size="compact-sm"
                variant="subtle"
                onClick={() => {
                  notifications.hide(toast);
                  reopenTask(id);
                }}
              >
                Undo
              </Button>
            )}
          </Group>
        ),
      });
    }
    if (flash.added) {
      const { title, project, projectId } = flash.added;
      notifications.show({
        message: (
          <Text size="sm">
            “{title}” added to{' '}
            <Anchor
              component={Link}
              href={project === 'Inbox' ? '/inbox' : `/projects/${projectId}`}
              size="sm"
            >
              {project}
            </Anchor>
          </Text>
        ),
      });
    }
  }, [flash]);
  return null;
}

/** Installs the service worker, in production builds only. */
function ServiceWorker() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Not installable here (http, a private window): the app works anyway.
      });
  }, []);
  return null;
}

/**
 * Mantine around every page. There is no main.tsx (nestjsMvc() generates the
 * entry), so each layout mounts this; layouts persist across visits, so it
 * mounts once.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-left" autoClose={4000} limit={3} />
      <FlashToasts />
      <ServiceWorker />
      <XrayShortcut />
      {children}
      <XrayOverlay />
    </MantineProvider>
  );
}
