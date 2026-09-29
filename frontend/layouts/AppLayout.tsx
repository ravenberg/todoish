import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useHotkeys, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  IconBolt,
  IconCalendar,
  IconCalendarEvent,
  IconCategory,
  IconChartBar,
  IconChevronDown,
  IconCircleCheck,
  IconHash,
  IconInbox,
  IconLayoutSidebar,
  IconLogout,
  IconMoon,
  IconNotes,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSun,
  IconUsers,
} from '@tabler/icons-react';
import { Link, router, usePage } from 'nestjs-mvc/react';
import { type ReactNode, useEffect, useState } from 'react';
import { LogoMark } from '../components/Logo';
import { Providers } from '../components/Providers';
import {
  type ProjectFields,
  ProjectForm,
  registerProjectForm,
  showProjectForm,
} from '../components/ProjectForm';
import { QuickAdd } from '../components/QuickAdd';
import { SearchSpotlight, openSearch } from '../components/SearchSpotlight';
import { TaskDialog } from '../components/TaskDialog';
import { colorOf } from '../lib/colors';
import { initials } from '../lib/format';
import { openQuickAdd } from '../lib/quickAdd';
import { setCurrentComponent } from '../lib/tasks';
import type { SharedProps, SidebarProject } from '../types';
import { setXray } from '../xray/XrayOverlay';

/** Today's icon shows today's date, like Todoist's. */
function TodayIcon({ size = 18, today }: { size?: number; today: string }) {
  return (
    <Box pos="relative" w={size} h={size} style={{ flex: 'none' }}>
      <IconCalendar size={size} stroke={1.6} />
      <Text
        fz={size * 0.42}
        fw={700}
        pos="absolute"
        top={size * 0.36}
        left={0}
        right={0}
        ta="center"
        lh={1}
      >
        {Number(today.slice(8))}
      </Text>
    </Box>
  );
}

function Count({ value }: { value?: number }) {
  return value ? (
    <Text size="xs" c="dimmed">
      {value}
    </Text>
  ) : null;
}

function UserMenu() {
  const { props } = usePage<SharedProps>();
  const user = props.auth.user!;
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <Menu position="bottom-start" width={240}>
      <Menu.Target>
        <UnstyledButton className="user-button" px={6} py={4}>
          <Group gap={8} wrap="nowrap">
            <Avatar size={26} radius="xl" color="tomato">
              {initials(user.name)}
            </Avatar>
            <Text size="sm" fw={600} truncate maw={130}>
              {user.name.split(' ')[0]}
            </Text>
            <IconChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{user.email}</Menu.Label>
        <Menu.Item
          component={Link}
          href="/settings"
          leftSection={<IconSettings size={16} />}
        >
          Settings
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/productivity"
          leftSection={<IconChartBar size={16} />}
        >
          Productivity
        </Menu.Item>
        <Menu.Item
          leftSection={dark ? <IconSun size={16} /> : <IconMoon size={16} />}
          onClick={() => setColorScheme(dark ? 'light' : 'dark')}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconBolt size={16} />}
          rightSection={
            <Text size="xs" c="dimmed">
              Shift+X
            </Text>
          }
          onClick={() => setXray(!props.__xray)}
        >
          {props.__xray ? 'Turn X-ray off' : 'Turn X-ray on'}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconLogout size={16} />}
          onClick={() => router.post('/logout')}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ProjectLink({
  project,
  active,
  count,
}: {
  project: SidebarProject;
  active: boolean;
  count?: number;
}) {
  return (
    <NavLink
      component={Link}
      href={`/projects/${project.id}`}
      prefetch
      className="side-link"
      label={project.name}
      active={active}
      leftSection={<IconHash size={18} color={colorOf(project.color)} />}
      rightSection={
        <Group gap={6} wrap="nowrap">
          {project.shared && (
            <IconUsers size={14} color="var(--mantine-color-dimmed)" />
          )}
          <Count value={count} />
        </Group>
      }
    />
  );
}

function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const { url, props } = usePage<SharedProps>();
  const path = url.split('?')[0];
  const counts = props.counts;
  const projects = props.sidebar?.projects.filter((p) => !p.isInbox) ?? [];
  const favorites = projects.filter((p) => p.favorite);

  const nav: [string, string, ReactNode, number | undefined][] = [
    ['/inbox', 'Inbox', <IconInbox size={18} stroke={1.6} />, counts?.inbox],
    ['/today', 'Today', <TodayIcon today={props.today} />, counts?.today],
    [
      '/upcoming',
      'Upcoming',
      <IconCalendarEvent size={18} stroke={1.6} />,
      undefined,
    ],
    [
      '/filters-labels',
      'Filters & Labels',
      <IconCategory size={18} stroke={1.6} />,
      undefined,
    ],
    [
      '/completed',
      'Completed',
      <IconCircleCheck size={18} stroke={1.6} />,
      undefined,
    ],
  ];

  return (
    <Stack gap={0} h="100%">
      <Group justify="space-between" px="sm" pt="sm" pb={4} wrap="nowrap">
        <UserMenu />
        <Tooltip label="Close sidebar">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onCollapse}
            aria-label="Close sidebar"
          >
            <IconLayoutSidebar size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea style={{ flex: 1 }} px="xs" type="scroll">
        <Stack gap={1} pb="md">
          <NavLink
            className="side-link add-task-link"
            label="Add task"
            leftSection={
              <span className="add-task-circle">
                <IconPlus size={14} stroke={3} />
              </span>
            }
            onClick={() => openQuickAdd()}
            fw={600}
          />
          <NavLink
            className="side-link"
            label="Search"
            leftSection={<IconSearch size={18} stroke={1.6} />}
            rightSection={
              <Text size="xs" c="dimmed">
                ⌘K
              </Text>
            }
            onClick={openSearch}
          />
          {nav.map(([href, label, icon, count]) => (
            <NavLink
              key={href}
              component={Link}
              href={href}
              prefetch
              className="side-link"
              label={label}
              leftSection={icon}
              rightSection={<Count value={count} />}
              active={path === href}
            />
          ))}

          {favorites.length > 0 && (
            <>
              <Text size="xs" fw={700} c="dimmed" px="sm" pt="lg" pb={4}>
                Favorites
              </Text>
              {favorites.map((p) => (
                <ProjectLink
                  key={p.id}
                  project={p}
                  active={path === `/projects/${p.id}`}
                  count={counts?.projects[p.id]}
                />
              ))}
            </>
          )}

          <Group justify="space-between" px="sm" pt="lg" pb={4}>
            <Text
              component={Link}
              href="/projects"
              size="xs"
              fw={700}
              c="dimmed"
            >
              My Projects
            </Text>
            <Tooltip label="Add project">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => showProjectForm()}
                aria-label="Add project"
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {projects.map((p) => (
            <ProjectLink
              key={p.id}
              project={p}
              active={path === `/projects/${p.id}`}
              count={counts?.projects[p.id]}
            />
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

/** Four tabs and the red +, floating at the bottom of a phone screen. */
function TabBar() {
  const { url, props } = usePage<SharedProps>();
  const path = url.split('?')[0];
  const tabs: [string, string, ReactNode][] = [
    ['/inbox', 'Inbox', <IconInbox size={22} stroke={1.6} />],
    ['/today', 'Today', <TodayIcon size={22} today={props.today} />],
    ['/upcoming', 'Upcoming', <IconCalendarEvent size={22} stroke={1.6} />],
    ['/browse', 'Browse', <IconNotes size={22} stroke={1.6} />],
  ];
  const browsing = !tabs.slice(0, 3).some(([href]) => path === href);
  return (
    <>
      <UnstyledButton
        className="fab"
        onClick={() => openQuickAdd()}
        aria-label="Add task"
      >
        <IconPlus size={26} stroke={2.5} />
      </UnstyledButton>
      <nav className="tab-bar" aria-label="Main">
        {tabs.map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            prefetch
            className="tab"
            data-active={
              (href === '/browse' ? browsing : path === href) || undefined
            }
          >
            {icon}
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const page = usePage<SharedProps>();
  const phone = useMediaQuery('(max-width: 48em)');
  const [collapsed, setCollapsed] = useLocalStorage({
    key: 'todoish-sidebar-collapsed',
    defaultValue: false,
  });
  const [projectForm, setProjectForm] = useState<{
    open: boolean;
    project?: ProjectFields & { id: number };
  }>({ open: false });
  setCurrentComponent(page.component);

  useEffect(
    () =>
      registerProjectForm((project) => setProjectForm({ open: true, project })),
    [],
  );
  // Q for quick add, as in Todoist; M toggles the sidebar.
  useHotkeys([
    ['q', () => openQuickAdd()],
    ['m', () => setCollapsed((c) => !c)],
  ]);

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: true, desktop: collapsed },
      }}
      padding={0}
    >
      <AppShell.Navbar className="sidebar" withBorder={false}>
        <Sidebar onCollapse={() => setCollapsed(true)} />
      </AppShell.Navbar>
      <AppShell.Main className="main">
        {collapsed && !phone && (
          <Group className="collapsed-bar" gap={4}>
            <Tooltip label="Open sidebar">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setCollapsed(false)}
                aria-label="Open sidebar"
              >
                <IconLayoutSidebar size={18} />
              </ActionIcon>
            </Tooltip>
            <LogoMark size={22} />
          </Group>
        )}
        <Box className="content">{children}</Box>
        {phone && <TabBar />}
      </AppShell.Main>
      <QuickAdd />
      <TaskDialog />
      <SearchSpotlight />
      <ProjectForm
        key={projectForm.project?.id ?? 'new'}
        opened={projectForm.open}
        project={projectForm.project}
        onClose={() => setProjectForm({ open: false })}
      />
    </AppShell>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}

/** For `Page.layout = appLayout`. */
export const appLayout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
