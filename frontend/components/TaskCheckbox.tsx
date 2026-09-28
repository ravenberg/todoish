import { UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { PRIORITY_COLOR } from '../lib/colors';

/**
 * Todoist's round checkbox: its ring has the priority's colour, a tick
 * shows on hover, and clicking fills it for a moment before the task goes.
 */
export function TaskCheckbox({
  priority,
  done = false,
  onCheck,
  size = 20,
}: {
  priority: number;
  done?: boolean;
  onCheck: () => void;
  size?: number;
}) {
  const [checking, setChecking] = useState(false);
  const color = PRIORITY_COLOR[priority];
  const filled = done || checking;
  return (
    <UnstyledButton
      className="task-check"
      data-filled={filled || undefined}
      aria-label={done ? 'Mark as not done' : 'Complete task'}
      onClick={(event) => {
        event.stopPropagation();
        if (done) return onCheck();
        setChecking(true);
        // Long enough to see the tick, short enough not to wait for it.
        setTimeout(() => {
          onCheck();
          setChecking(false);
        }, 220);
      }}
      style={
        {
          '--check-color': color,
          '--check-size': `${size}px`,
        } as React.CSSProperties
      }
    >
      <IconCheck size={size * 0.6} stroke={3} />
    </UnstyledButton>
  );
}
