# Todoish

Like Todoist, but ish.

Todoish is the demo app for [nestjs-mvc](https://nestjs-mvc.ravenberg.dev),
the package that lets NestJS controllers return React pages as their views.
It's a to-do app you already know how to use: Inbox, Today, Upcoming,
projects with boards, quick add that reads "tomorrow 4pm p1", shared
projects, a phone layout with tabs and a big red plus. Because you know the
app, you can look at how it's built instead of at what it does.

Every screen is a controller and a React component, and nothing else. There
is no API layer, no client-side store and no loading spinners you wrote
yourself.

**Live demo: https://todoish.ravenberg.dev** (log in as `ada@todoish.dev`
with password `password`; everything starts over every night).

Todoish isn't affiliated with Todoist. Todoist is the real thing, and good.

## Try it

```sh
git clone https://github.com/ravenberg/todoish.git
cd todoish
npm install
npm run start:dev
```

Open http://localhost:3000 and log in. Every account's password is `password`:

| Email | Who |
|---|---|
| `ada@todoish.dev` | Has the most going on. Start here. |
| `grace@todoish.dev` | Shares two projects with Ada. |
| `linus@todoish.dev` | Shares one. |

The first start creates a SQLite database with a few projects and a couple of
months of finished tasks, dated around today. `npm run db:reset` deletes it,
so the next start seeds a fresh one. You need Node 20.19+, 22.12+ or 24+.

While you click around:

* Press **Shift+X** to open X-ray. For the page you're on, it shows which
  nestjs-mvc features it uses, which props the controller sent, and every
  request the page makes, with a link to the docs for each feature.
* Press **Q** for quick add, and type something like
  `Pay rent every month p2 #Home @errands`.
* Open **Todoish launch** as Ada and run `npm run collaborator:demo` in a
  second terminal. Grace starts working in the project, and her changes show
  up while you watch.
* Run `npm run email:demo` and look at the Inbox: that's an email forwarded
  to Todoish, through a webhook.
* Make the window narrow, or open it on your phone and add it to your home
  screen. It becomes an app with tabs and sheets.

## Where to look

It's a regular NestJS app: modules, controllers, services, guards and pipes,
with TypeORM. What nestjs-mvc changes is that a controller method has
`@View()` and returns props, and a React component in `frontend/pages`
renders them.

A good first read is `src/tasks/tasks.controller.ts` with
`frontend/pages/Tasks/Today.tsx`, then `src/tasks/task-detail.ts` for the
task dialog that every list shares.

| To see | Look at |
|---|---|
| A controller that renders a page | `src/tasks/tasks.controller.ts`, `frontend/pages/Tasks/Today.tsx` |
| A dialog that loads only when it opens (`optional()`) | `src/tasks/task-detail.ts`, `frontend/components/TaskDialog.tsx` |
| Ticking a task off before the server answers | `frontend/lib/tasks.ts` (`completeTask`) |
| Undo, carried in a flash message | `src/tasks/tasks.controller.ts` (`complete`), `frontend/components/Providers.tsx` |
| Asking the server while you type, as JSON (`useHttp`) | `src/tasks/tasks.controller.ts` (`parse`), `frontend/components/QuickAdd.tsx` |
| Forms and validation with Zod | `src/tasks/tasks.schemas.ts` |
| Validating while you type, with rules from the database | `src/auth/auth.controller.ts` (`RegisterPipe`), `frontend/pages/Auth/Register.tsx` |
| Validating a filter query with the server's own parser | `src/filters/filters.schemas.ts`, `frontend/pages/Filters/Index.tsx` |
| Two forms on one page (error bags) | `frontend/pages/Settings/Index.tsx`, `frontend/components/TaskDialog.tsx` |
| Data every page gets (today, the counts) | `src/shared-data.middleware.ts` |
| A sidebar the browser keeps between pages (`once()`), refreshed after a change | `src/shared-data.middleware.ts`, `src/projects/projects.controller.ts` (`create`) |
| Pages that load before you click them (prefetch) | `frontend/layouts/AppLayout.tsx` |
| Infinite scroll, a week at a time | `src/upcoming/upcoming.controller.ts`, `frontend/pages/Upcoming/Index.tsx` |
| Loading older items as you scroll (`merge()`) | `src/activity/activity.controller.ts`, `frontend/pages/Completed/Index.tsx` |
| Live changes from other people (polling, `deepMerge()`) | `src/projects/projects.controller.ts` (`show`), `frontend/pages/Projects/Show.tsx` |
| New comments on top (`prepend()`) | `src/tasks/task-detail.ts` |
| Drag and drop on a board | `frontend/components/Board.tsx`, `frontend/lib/tasks.ts` (`moveTask`) |
| File uploads and downloads | `src/comments/comments.controller.ts`, `src/common/file.pipe.ts` |
| Importing and exporting CSV, and a download from a link (`view.location()`) | `src/projects/projects.controller.ts` (`export`, `import`) |
| Slow numbers after the page shows (`defer()`), and a block that may fail | `src/productivity/productivity.controller.ts`, `frontend/pages/Productivity/Index.tsx` |
| Signed links: invitations that work once | `src/invitations/invitations.controller.ts`, `src/projects/projects.controller.ts` (`invite`) |
| A signed calendar feed you can reset | `src/calendar/calendar.controller.ts`, `src/settings/settings.controller.ts` |
| A webhook without CSRF protection | `src/hooks/hooks.controller.ts` |
| Server rendering: the landing page and invitation links | `src/home/home.controller.ts`, `src/invitations/invitations.controller.ts` |
| History encryption, and clearing it on logout | `src/privacy.interceptor.ts`, `src/auth/auth.controller.ts` (`logout`) |
| Who may see what, and a 403 page | `src/projects/projects.service.ts` (`find`), `frontend/pages/Errors/Show.tsx` |
| Remembering a tab when you go back | `frontend/pages/Settings/Index.tsx` (`useRemember`) |
| Testing pages end to end | `test/app.e2e-spec.ts` |

A few parts are Todoish itself rather than nestjs-mvc: the quick add parser
(`src/tasks/quick-add.ts`), recurring tasks (`src/tasks/recurrence.ts`), the
filter language (`src/filters/query.ts`) and karma (`src/productivity/karma.ts`).
They're plain functions with unit tests next to them.

`src/xray` and `frontend/xray` are the X-ray overlay. That's tooling for this
demo, not something a normal app needs, so you can skip them while reading.

The [nestjs-mvc docs](https://nestjs-mvc.ravenberg.dev) explain each of these
features on its own.

## On your phone

Todoish is a PWA. `public/manifest.webmanifest` makes it installable, and
`public/sw.js` is a small service worker that caches the built assets and the
icons, so the app starts quickly. It never caches your tasks: pages and page
data always come from the server, so you never see yesterday's list. Without
a connection you get a friendly offline page instead.

The logo is drawn once, in `public/favicon.svg`. `npm run icons` draws the
PNG icons from it.

## Checks

```sh
npm run lint
npm run typecheck
npm test           # unit tests
npm run test:e2e   # the whole app, against an in-memory database
```

## Running it on a server

The live demo runs on Ubuntu with pm2 and Caddy, and starts over with fresh
data every night. Everything for that is in `ops/`.

You need Node, pm2 (`npm install -g pm2`), Caddy, and `build-essential` and
`python3` in case `better-sqlite3` has to be compiled.

```sh
git clone https://github.com/ravenberg/todoish.git ~/todoish
cd ~/todoish
cp .env.example .env   # fill in APP_KEY
ops/deploy.sh
pm2 startup            # once, so pm2 starts again after a reboot
```

Then let Caddy forward your domain to the port in `.env`:

```text
todoish.ravenberg.dev {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3003
}
```

What the scripts do:

* `ops/deploy.sh` pulls, installs, builds, restarts the app with pm2, and
  schedules the nightly reset. Run it again for every update.
* `ops/reset.sh` stops the app, deletes the database and the uploaded files,
  and starts the app again, which seeds new data. Cron runs it every night at
  04:00; `ops/schedule-reset.sh` sets that up (`RESET_AT="30 3 * * *"` for
  another time). It logs to `data/reset.log`.

The settings in `.env`:

| Variable | What it's for |
|---|---|
| `APP_KEY` | Signs cookies, links and the login token. Required in production. |
| `PORT` | The port the app listens on. |
| `DATABASE_PATH`, `STORAGE_PATH` | Where the database and uploads are kept. |
