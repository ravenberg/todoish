/**
 * Opens quick add from anywhere: the sidebar button, the red + on a phone,
 * "Add task" under a list or a day. What a page knows (this project, this
 * section, this day) comes along as defaults.
 */
export interface QuickAddDefaults {
  projectId?: number | null;
  sectionId?: number | null;
  dueDate?: string | null;
  parentId?: number | null;
  /** Placeholder, e.g. the section's name. */
  context?: string;
}

type Listener = (defaults: QuickAddDefaults) => void;
let listener: Listener = () => {};

export const onQuickAdd = (fn: Listener) => {
  listener = fn;
};
/** What the current page suggests: set by project pages, Today, Upcoming. */
let pageDefaults: QuickAddDefaults = {};
export const setPageDefaults = (defaults: QuickAddDefaults) => {
  pageDefaults = defaults;
};

export const openQuickAdd = (defaults?: QuickAddDefaults) =>
  listener(defaults ?? pageDefaults);
