/**
 * Todoist's palette for projects, labels and filters. The names match
 * src/projects/projects.schemas.ts; the server stores the name, not the hex.
 */
export const COLORS = {
  berry_red: '#b8255f',
  red: '#db4035',
  orange: '#ff9933',
  yellow: '#fad000',
  olive_green: '#afb83b',
  lime_green: '#7ecc49',
  green: '#299438',
  mint_green: '#6accbc',
  teal: '#158fad',
  sky_blue: '#14aaf5',
  light_blue: '#96c3eb',
  blue: '#4073ff',
  grape: '#884dff',
  violet: '#af38eb',
  lavender: '#eb96eb',
  magenta: '#e05194',
  salmon: '#ff8d85',
  charcoal: '#808080',
  grey: '#b8b8b8',
  taupe: '#ccac93',
} as const;

export type ColorName = keyof typeof COLORS;

export const colorOf = (name: string) =>
  COLORS[name as ColorName] ?? COLORS.charcoal;

export const COLOR_OPTIONS = (Object.keys(COLORS) as ColorName[]).map(
  (name) => ({
    value: name,
    label: name
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  }),
);

/** Priority 1 to 4, as Todoist colours them: red, orange, blue, none. */
export const PRIORITY_COLOR: Record<number, string> = {
  1: '#d1453b',
  2: '#eb8909',
  3: '#246fe0',
  4: 'var(--mantine-color-dimmed)',
};
