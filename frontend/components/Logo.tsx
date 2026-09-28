import { Group, Text } from '@mantine/core';

/**
 * Todoist's red square with its three check marks, but ish: the square leans,
 * the marks don't line up, and the last one has clearly given up. A parody,
 * not a copy. public/favicon.svg is the same drawing.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Todoish"
      style={{ flex: 'none', display: 'block' }}
    >
      <g transform="rotate(-8 32 32)">
        <rect x="6" y="6" width="52" height="52" rx="13" fill="#dc4c3e" />
        <g
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 23.5 L22 27.5 L44 16" />
          <path d="M18.5 34.5 L24.5 38 L47 26.5" />
          <path d="M15 46 L20.5 48.5 L39 42.5" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Group gap={8} wrap="nowrap">
      <LogoMark size={size} />
      <Text
        fw={800}
        fz={size * 0.78}
        c="tomato.6"
        lh={1}
        style={{ letterSpacing: '-0.03em' }}
      >
        todoish
      </Text>
    </Group>
  );
}
