# Notes from building Todoish

Things about nestjs-mvc 0.1.0 that came up while building this app. None of
them block it; each has a workaround in the code. Not filed as issues yet.

## Still open

* **`always()` children are dropped on a partial reload** (nestjs-mvc#8).
  `resolveNode` treats the `always()` value itself as fully matched, but then
  re-matches its children against `only`, so an object inside `always()`
  arrives empty on a reload that doesn't name it. X-ray's `__xray` prop is
  `always()`, so it's still wrapped in `src/common/opaque.ts`.

* **A helper can't be both `optional()` and `prepend()`.** Each prop takes one
  wrapper. The task dialog wants comments that are only sent when the dialog
  is open (optional) and that a poll adds to (prepend). The workaround: a
  `prepend()` whose closure returns `[]` when there's no `?task=`, and the
  client passes `reset: ['comments']` when it opens another task.
  (`src/tasks/task-detail.ts`)

* **Helpers nested under an `optional()` parent can't be reloaded on their
  own.** Asking for `only: ['task.comments']` makes the resolver "descend"
  into `task`, and an optional prop that isn't fully matched is skipped. So
  comments had to become a top level prop.

* **`@Body({ schema })` needs a static schema.** A rule that needs the
  database (an email that's taken) can't be in it. Todoish uses an injectable
  pipe that builds the Zod schema at runtime and throws
  `standardSchemaExceptionFactory(issues)`, which Precognition runs like any
  other pipe (`src/common/validate.ts`, `RegisterPipe`). It works well, but
  X-ray can't see the fields of such a body, and a small helper in the
  package (say `@Body(schemaPipe((req) => schema))`) would make it tidier.

* **`SKIP_CSRF_METADATA` isn't exported**, so X-ray hard-codes
  `'mvc:skip-csrf'` (carried over from Pager Pulse).

## Good to know (not bugs)

* A form post with `X-Inertia` and an empty `X-Inertia-Version` gets a 409,
  like a GET. In the e2e tests the helper visits a page right after logging
  in, so the version is known before the first post.
* `WhenVisible` counts its props as loaded when they're already on the page,
  so for "load more" with a cursor it needs `always`, and a `key` per cursor.
  (`frontend/pages/Completed/Index.tsx`)
* The `invitation` flash from a post followed by a partial reload (`only:
  ['share']`) arrives fine: flash is page level, not a prop.
* Not nestjs-mvc: TypeORM can't `take()` a query with joins that is ordered
  by an expression (`dueDate IS NULL`). Search slices in JavaScript instead.
