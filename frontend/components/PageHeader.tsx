import { ActionIcon, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconChartBar,
  IconDots,
  IconHistory,
  IconSettings,
} from '@tabler/icons-react';
import { Head, Link } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';

/** Where the "…" goes when a page has nothing of its own to offer. */
function DefaultMenu() {
  return (
    <>
      <Menu.Item
        component={Link}
        href="/completed?kind=all"
        leftSection={<IconHistory size={16} />}
      >
        Activity log
      </Menu.Item>
      <Menu.Item
        component={Link}
        href="/productivity"
        leftSection={<IconChartBar size={16} />}
      >
        Productivity
      </Menu.Item>
      <Menu.Item
        component={Link}
        href="/settings"
        leftSection={<IconSettings size={16} />}
      >
        Settings
      </Menu.Item>
    </>
  );
}

function MoreMenu({ children }: { children: ReactNode }) {
  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="xl"
          size="lg"
          aria-label="More"
        >
          <IconDots size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  );
}

/**
 * A page's title. On a phone the buttons move above it into a small
 * floating pill, the way Todoist's iOS app has them; `phoneActions` are
 * icon buttons for that pill, `menu` fills its "…".
 */
export function PageHeader({
  title,
  icon,
  description,
  actions,
  phoneActions,
  menu,
}: {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  phoneActions?: ReactNode;
  menu?: ReactNode;
}) {
  const phone = useMediaQuery('(max-width: 48em)');
  return (
    <>
      <Head title={`${title} · Todoish`} />
      {phone && (
        <Group justify="flex-end" mb={4} mt={-6}>
          <div className="phone-actions">
            {phoneActions}
            <MoreMenu>{menu ?? <DefaultMenu />}</MoreMenu>
          </div>
        </Group>
      )}
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={8} wrap="nowrap">
            {icon}
            <Title order={1} lineClamp={2}>
              {title}
            </Title>
          </Group>
          {description && (
            <Text c="dimmed" size="sm" component="div">
              {description}
            </Text>
          )}
        </Stack>
        {!phone && (actions || menu) && (
          <Group gap={4} wrap="nowrap">
            {actions}
            {menu && <MoreMenu>{menu}</MoreMenu>}
          </Group>
        )}
      </Group>
    </>
  );
}
