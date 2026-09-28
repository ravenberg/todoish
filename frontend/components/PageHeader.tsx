import { Group, Stack, Text, Title } from '@mantine/core';
import { Head } from 'nestjs-mvc/react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  icon,
  description,
  actions,
}: {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
      <Head title={`${title} · Todoish`} />
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
      {actions}
    </Group>
  );
}
