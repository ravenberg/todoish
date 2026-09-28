import {
  ActionIcon,
  Avatar,
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy, IconLink, IconX } from '@tabler/icons-react';
import { router, usePage } from 'nestjs-mvc/react';
import { useEffect } from 'react';
import { initials } from '../lib/format';

interface Share {
  people: { id: number; name: string; owner: boolean }[];
  pending: number;
}

/**
 * Share a project. What's in it (the members) is an `optional()` prop: it
 * isn't part of the project page until this dialog opens and asks for it.
 * "Copy invite link" makes a signed, single-use link; it comes back as a
 * flash, and whoever opens it joins, even without an account.
 */
export function ShareDialog({
  projectId,
  mine,
  opened,
  onClose,
}: {
  projectId: number;
  mine: boolean;
  opened: boolean;
  onClose: () => void;
}) {
  const page = usePage<{ share?: Share }>();
  const share = page.props.share;
  const link = (page.flash as { invitation?: string } | undefined)?.invitation;
  const absolute = link ? new URL(link, window.location.origin).href : null;

  useEffect(() => {
    if (opened) router.reload({ only: ['share'] });
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Share project" size="md">
      <Stack>
        <Group gap="xs" align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label="Invite link"
            description="Works once, for a week. Anyone who opens it joins, and can sign up on the spot."
            readOnly
            value={absolute ?? ''}
            placeholder="Make a link to share"
            leftSection={<IconLink size={16} />}
          />
          {absolute ? (
            <CopyButton value={absolute}>
              {({ copied, copy }) => (
                <Button
                  onClick={copy}
                  color={copied ? 'teal' : undefined}
                  leftSection={
                    copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                  }
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          ) : (
            <Button
              onClick={() =>
                router.post(
                  `/projects/${projectId}/invitations`,
                  {},
                  {
                    only: ['share'],
                    preserveScroll: true,
                    preserveState: true,
                  },
                )
              }
            >
              Make link
            </Button>
          )}
        </Group>

        <Text size="sm" fw={600} mt="sm">
          In this project
        </Text>
        {!share ? (
          <Loader size="sm" />
        ) : (
          <Stack gap="xs" data-xray="share">
            {share.people.map((person) => (
              <Group key={person.id} justify="space-between">
                <Group gap="sm">
                  <Avatar
                    size={30}
                    radius="xl"
                    color="initials"
                    name={person.name}
                  >
                    {initials(person.name)}
                  </Avatar>
                  <Text size="sm">{person.name}</Text>
                </Group>
                {person.owner ? (
                  <Text size="xs" c="dimmed">
                    Owner
                  </Text>
                ) : (
                  mine && (
                    <Tooltip label="Remove from project">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() =>
                          router.delete(
                            `/projects/${projectId}/members/${person.id}`,
                            {
                              only: ['share', 'people'],
                              preserveState: true,
                              preserveScroll: true,
                            },
                          )
                        }
                        aria-label={`Remove ${person.name}`}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )
                )}
              </Group>
            ))}
            {share.pending > 0 && (
              <Text size="xs" c="dimmed">
                {share.pending} invite link{share.pending === 1 ? '' : 's'} not
                used yet.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
