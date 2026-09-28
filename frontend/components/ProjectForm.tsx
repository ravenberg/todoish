import {
  Button,
  ColorSwatch,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { useForm } from 'nestjs-mvc/react';
import type { FormEvent } from 'react';
import { COLOR_OPTIONS, colorOf } from '../lib/colors';

export interface ProjectFields {
  name: string;
  color: string;
  viewStyle: 'list' | 'board';
  favorite: boolean;
}

let openProjectForm: (
  project?: ProjectFields & { id: number },
) => void = () => {};
export const showProjectForm = (project?: ProjectFields & { id: number }) =>
  openProjectForm(project);

/** Add or edit a project: name, colour, list or board, favourite. */
export function ProjectForm({
  opened,
  onClose,
  project,
}: {
  opened: boolean;
  onClose: () => void;
  project?: ProjectFields & { id: number };
}) {
  const form = useForm<ProjectFields>({
    name: project?.name ?? '',
    color: project?.color ?? 'charcoal',
    viewStyle: project?.viewStyle ?? 'list',
    favorite: project?.favorite ?? false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const options = {
      errorBag: 'project',
      onSuccess: onClose,
      preserveScroll: true,
    };
    if (project) form.patch(`/projects/${project.id}`, options);
    else form.post('/projects', options);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={project ? 'Edit project' : 'Add project'}
      size="md"
    >
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Name"
            data-autofocus
            value={form.data.name}
            onChange={(e) => form.setData('name', e.currentTarget.value)}
            error={form.errors.name}
            maxLength={120}
          />
          <Select
            label="Color"
            data={COLOR_OPTIONS}
            value={form.data.color}
            allowDeselect={false}
            leftSection={
              <ColorSwatch color={colorOf(form.data.color)} size={14} />
            }
            renderOption={({ option }) => (
              <Group gap="xs">
                <ColorSwatch color={colorOf(option.value)} size={14} />
                {option.label}
              </Group>
            )}
            onChange={(color) => color && form.setData('color', color)}
          />
          <Switch
            label="Add to favorites"
            checked={form.data.favorite}
            onChange={(e) => form.setData('favorite', e.currentTarget.checked)}
          />
          <SegmentedControl
            data={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
            value={form.data.viewStyle}
            onChange={(v) => form.setData('viewStyle', v as 'list' | 'board')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={form.processing}
              disabled={!form.data.name.trim()}
            >
              {project ? 'Save' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function registerProjectForm(
  open: (project?: ProjectFields & { id: number }) => void,
) {
  openProjectForm = open;
}
