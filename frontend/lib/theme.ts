import { type MantineColorsTuple, createTheme, rem } from '@mantine/core';

/**
 * Todoish looks like what it parodies: warm off-white, lots of air, and one
 * red. Red is the brand here (the logo, the add button, the checkbox of a
 * p1 task, today in the calendar), not an alarm.
 */
const tomato: MantineColorsTuple = [
  '#fff0ee',
  '#ffe0dc',
  '#fbbdb5',
  '#f5988c',
  '#f07869',
  '#ec6453',
  '#dc4c3e',
  '#c43d30',
  '#ae3327',
  '#97291e',
];

export const theme = createTheme({
  colors: { tomato },
  primaryColor: 'tomato',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontWeight: '700',
    sizes: { h1: { fontSize: rem(26), lineHeight: '1.3' } },
  },
  components: {
    Modal: {
      defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.35 } },
    },
    Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.35 } } },
    Menu: { defaultProps: { radius: 'md', shadow: 'md' } },
    Popover: { defaultProps: { radius: 'md', shadow: 'md' } },
    Tooltip: { defaultProps: { openDelay: 400, withArrow: true } },
    Notification: { defaultProps: { radius: 'md' } },
  },
});
