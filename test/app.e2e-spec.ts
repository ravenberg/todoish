import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * The whole app against a fresh in-memory database, seeded as on first start.
 * Requests speak the Inertia protocol the way the browser client does.
 * CSRF protection is off under NODE_ENV=test, as nestjs-mvc does by default.
 * The tests run in order and build on each other, like a person clicking
 * through the demo.
 */
let app: INestApplication;
let db: DataSource;

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  process.env.STORAGE_PATH = await mkdtemp(join(tmpdir(), 'todoish-'));
  // Imported late: the database module reads DATABASE_PATH when it loads.
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(module.createNestApplication());
  await app.init();
  db = app.get(DataSource);
});

afterAll(() => app?.close());

/** A browser: keeps cookies and the page version the server last answered with. */
function browser() {
  const agent = request.agent(app.getHttpServer());
  let version = '';

  /**
   * A page visit. A 409 for a new version (and then possibly a new user) is
   * retried with the version the server sent, as the browser reloads. A 409
   * with a location is `view.location()`, and is the answer.
   */
  async function visit(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<request.Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await agent
        .get(url)
        .set({ 'X-Inertia': 'true', 'X-Inertia-Version': version, ...headers });
      const location = response.headers['x-inertia-location'];
      if (response.status !== 409 || (location && location !== url))
        return response;
      version = response.headers['x-inertia-version'] ?? '';
    }
    throw new Error(`${url} kept answering 409`);
  }

  /** A partial reload of `component`, asking for `only` these props. */
  const partial = (
    url: string,
    component: string,
    only: string,
    headers: Record<string, string> = {},
  ) =>
    visit(url, {
      'X-Inertia-Partial-Component': component,
      'X-Inertia-Partial-Data': only,
      ...headers,
    });

  /** Logs in, then opens Today, so the page version is known for form posts. */
  async function login(email: string, password = 'password') {
    await agent.post('/login').send({ email, password }).expect(302);
    await visit('/today');
  }

  /** The headers the Inertia client sends with a form submission. */
  const inertia = () => ({ 'X-Inertia': 'true', 'X-Inertia-Version': version });

  return { agent: agent as TestAgent, visit, partial, login, inertia };
}

async function ada() {
  const b = browser();
  await b.login('ada@todoish.dev');
  return b;
}

async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  return (await db.query(sql, params))[0] as T;
}

const idOf = async (table: string, where: string) =>
  (await one<{ id: number }>(`SELECT id FROM ${table} WHERE ${where}`)).id;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('phase 0: the shell', () => {
  it('sends a guest to the login page, and to Today after logging in', async () => {
    const guest = browser();
    const response = await guest.agent.get('/today').set('Accept', 'text/html');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');

    const login = await guest.agent
      .post('/login')
      .send({ email: 'ada@todoish.dev', password: 'password' })
      .expect(302);
    expect(login.headers.location).toBe('/today');
  });

  it('renders the landing page on the server, and skips it for users', async () => {
    const html = await request(app.getHttpServer())
      .get('/')
      .set('Accept', 'text/html')
      .expect(200);
    // Text from the React tree: only there when it was rendered server-side.
    expect(html.text).toContain('Organize your work and life');
    expect(html.text).toContain('rel="manifest"');

    const user = await ada();
    const home = await user.agent.get('/').set('Accept', 'text/html');
    expect(home.status).toBe(302);
    expect(home.headers.location).toBe('/today');
  });

  it('puts a wrong password on the email field', async () => {
    const guest = browser();
    await guest.agent
      .post('/login')
      .set({ ...guest.inertia(), Referer: '/login' })
      .send({ email: 'ada@todoish.dev', password: 'nope' })
      .expect(302);
    const page = (await guest.visit('/login')).body;
    expect(page.props.errors).toEqual({
      email: 'These credentials do not match our records.',
    });
  });

  it('checks sign-up fields live, including a taken email', async () => {
    const guest = browser();
    const taken = await guest.agent
      .post('/register')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'email' })
      .send({ name: '', email: 'ada@todoish.dev', password: '' });
    expect(taken.status).toBe(422);
    expect(taken.body.errors).toEqual({
      email: 'Someone already signed up with that address. Log in instead?',
    });

    await guest.agent
      .post('/register')
      .send({
        name: 'Katherine Johnson',
        email: 'katherine@nasa.dev',
        password: 'orbital-mechanics',
      })
      .expect(302);
    const page = (await guest.visit('/inbox')).body;
    expect(page.props.auth.user.name).toBe('Katherine Johnson');
    expect(page.props.tasks).toEqual([]);
  });

  it('clears browser history on logout', async () => {
    const user = await ada();
    await user.agent.post('/logout').expect(302);
    const page = (await user.visit('/login')).body;
    expect(page.clearHistory).toBe(true);
  });
});

describe('phase 1: tasks', () => {
  it('shows today and overdue on Today, with counts for the sidebar', async () => {
    const user = await ada();
    const page = (await user.visit('/today')).body;
    expect(page.component).toBe('Tasks/Today');
    const titles = page.props.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Expense report'); // overdue
    expect(titles).toContain('Prepare the nestjs-mvc talk');
    expect(page.props.counts.today).toBeGreaterThan(5);
    expect(page.props.sidebar.projects[0].name).toBe('Inbox');
    // The dialog's task is optional(): never part of a normal visit.
    expect(page.props.task).toBeUndefined();
  });

  it('reads quick add as you type, as JSON', async () => {
    const user = await ada();
    const parsed = await user.agent
      .get('/tasks/parse')
      .query({ text: 'Water the cactus every monday 9am p2 @quick #Home' })
      .expect(200);
    expect(parsed.body).toMatchObject({
      title: 'Water the cactus',
      recurrence: 'every monday',
      dueTime: '09:00',
      priority: 2,
      labels: ['quick'],
    });
    expect(parsed.body.tokens).toHaveLength(5);
  });

  it('adds a task from quick add, the text winning over where you were', async () => {
    const user = await ada();
    const home = await idOf('project', "name = 'Home'");
    const inbox = await idOf(
      'project',
      "isInbox = 1 AND ownerId = (SELECT id FROM user WHERE email = 'ada@todoish.dev')",
    );
    const response = await user.agent
      .post('/tasks')
      .set({ ...user.inertia(), Referer: '/inbox' })
      .send({
        text: 'Buy stamps tomorrow p1 @errands @stamps #Home',
        defaultProjectId: inbox,
      })
      .expect(302);
    expect(response.headers.location).toBe('/inbox');

    const task = await one<{ id: number; priority: number; projectId: number }>(
      "SELECT * FROM task WHERE title = 'Buy stamps'",
    );
    expect(task).toMatchObject({ priority: 1, projectId: home });
    const labels = await db.query(
      'SELECT l.name FROM label l JOIN task_labels_label tl ON tl.labelId = l.id WHERE tl.taskId = ? ORDER BY l.name',
      [task.id],
    );
    // "stamps" didn't exist: quick add made it.
    expect(labels.map((l: { name: string }) => l.name)).toEqual([
      'errands',
      'stamps',
    ]);

    const flash = (await user.visit('/inbox')).body.flash;
    expect(flash.added).toMatchObject({ title: 'Buy stamps', project: 'Home' });
  });

  it('opens the task dialog with a partial reload of just the task', async () => {
    const user = await ada();
    const talk = await idOf('task', "title = 'Prepare the nestjs-mvc talk'");
    const page = (
      await user.partial(
        `/today?task=${talk}`,
        'Tasks/Today',
        'task,comments,commentsCursor',
      )
    ).body;
    expect(Object.keys(page.props).sort()).toEqual([
      'comments',
      'commentsCursor',
      'errors',
      'task',
    ]);
    expect(
      page.props.task.subtaskRows.map((t: { title: string }) => t.title),
    ).toEqual([
      'Record a backup of the demo',
      'Rehearse with a timer',
      'Write the outline',
      'Pick nine features to show',
    ]);
    expect(page.prependProps).toEqual(['comments']);
  });

  it('completes a task with an undo, and moves a recurring one instead', async () => {
    const user = await ada();
    const milk = await idOf('task', "title = 'Buy oat milk'");
    await user.agent
      .post(`/tasks/${milk}/complete`)
      .set({ ...user.inertia(), Referer: '/today' })
      .expect(302);
    const page = (await user.partial('/today', 'Tasks/Today', 'tasks,counts'))
      .body;
    expect(page.flash.completed).toMatchObject({ id: milk, next: null });
    expect(page.props.tasks.some((t: { id: number }) => t.id === milk)).toBe(
      false,
    );

    await user.agent
      .post(`/tasks/${milk}/reopen`)
      .set({ ...user.inertia(), Referer: '/today' })
      .expect(302);
    expect(
      await one('SELECT completedAt FROM task WHERE id = ?', [milk]),
    ).toEqual({ completedAt: null });

    const daily = await one<{ id: number; dueDate: string }>(
      "SELECT id, dueDate FROM task WHERE title = 'Stretch for ten minutes'",
    );
    await user.agent
      .post(`/tasks/${daily.id}/complete`)
      .set(user.inertia())
      .expect(302);
    const moved = await one<{ dueDate: string; completedAt: null }>(
      'SELECT dueDate, completedAt FROM task WHERE id = ?',
      [daily.id],
    );
    expect(moved.completedAt).toBeNull();
    expect(moved.dueDate > daily.dueDate).toBe(true);
  });

  it('sends a bad edit back in its own error bag', async () => {
    const user = await ada();
    const passport = await idOf('task', "title = 'Renew passport'");
    await user.agent
      .patch(`/tasks/${passport}`)
      .set({
        ...user.inertia(),
        Referer: '/inbox',
        'X-Inertia-Error-Bag': 'task',
      })
      .send({ title: '   ', recurrence: 'every blue moon' })
      .expect(303);
    const page = (await user.visit('/inbox')).body;
    expect(page.props.errors).toEqual({
      task: {
        title: 'A task needs a name.',
        recurrence: 'Try “every day”, “every monday” or “every 2 weeks”.',
      },
    });
  });

  it('reschedules every overdue task in one go', async () => {
    const user = await ada();
    const today = (await user.visit('/today')).body.props.today;
    const overdue = (
      await db.query(
        "SELECT t.id FROM task t JOIN project_member m ON m.projectId = t.projectId JOIN user u ON u.id = m.userId WHERE u.email = 'ada@todoish.dev' AND t.completedAt IS NULL AND t.deletedAt IS NULL AND t.dueDate < ?",
        [today],
      )
    ).map((t: { id: number }) => t.id);
    expect(overdue.length).toBeGreaterThan(0);
    await user.agent
      .post('/tasks/reschedule')
      .set(user.inertia())
      .send({ ids: overdue, dueDate: today })
      .expect(302);
    const left = await db.query(
      `SELECT id FROM task WHERE id IN (${overdue.map(() => '?').join(',')}) AND dueDate < ?`,
      [...overdue, today],
    );
    expect(left).toEqual([]);
  });
});

describe('phase 2: projects', () => {
  it('shows a project with its sections, and says 403 to outsiders', async () => {
    const user = await ada();
    const work = await idOf('project', "name = 'Work'");
    const page = (await user.visit(`/projects/${work}`)).body;
    expect(page.component).toBe('Projects/Show');
    expect(page.props.sections.map((s: { name: string }) => s.name)).toEqual([
      'This week',
      'Waiting on',
      'Someday',
    ]);
    // Not shared, and the Share dialog's contents wait until it opens.
    expect(page.props.people).toHaveLength(1);
    expect(page.props.share).toBeUndefined();

    const grace = browser();
    await grace.login('grace@todoish.dev');
    const refused = await grace.visit(`/projects/${work}`);
    expect(refused.status).toBe(403);
    expect(refused.body.component).toBe('Errors/Show');
  });

  it('keeps the sidebar in the browser (once) until a project changes it', async () => {
    const user = await ada();
    const first = (await user.visit('/today')).body;
    expect(first.onceProps.sidebar).toBeTruthy();

    const kept = { 'X-Inertia-Except-Once-Props': 'sidebar' };
    const second = (await user.visit('/inbox', kept)).body;
    expect(second.props.sidebar).toBeUndefined();

    await user.agent
      .post('/projects')
      .set(user.inertia())
      .send({ name: 'Garden', color: 'green' })
      .expect(302);
    const refreshed = (await user.visit('/inbox', kept)).body;
    expect(
      refreshed.props.sidebar.projects.map((p: { name: string }) => p.name),
    ).toContain('Garden');
  });

  it('moves a task to another section, above another task', async () => {
    const user = await ada();
    const work = await idOf('project', "name = 'Work'");
    const someday = await idOf('section', "name = 'Someday'");
    const rust = await idOf('task', "title LIKE 'Learn Rust%'");
    const invoice = await idOf('task', "title LIKE 'Send the invoice%'");
    await user.agent
      .post(`/tasks/${invoice}/move`)
      .set(user.inertia())
      .send({ projectId: work, sectionId: someday, before: rust })
      .expect(302);
    const page = (
      await user.partial(`/projects/${work}`, 'Projects/Show', 'tasks')
    ).body;
    const column = page.props.tasks
      .filter(
        (t: { sectionId: number; parentId: null }) =>
          t.sectionId === someday && !t.parentId,
      )
      .sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      )
      .map((t: { id: number }) => t.id);
    expect(column.slice(0, 2)).toEqual([invoice, rust]);
  });

  it('exports CSV through location(), and imports it again', async () => {
    const user = await ada();
    const home = await idOf('project', "name = 'Home'");
    const visit = await user.visit(`/projects/${home}/export`);
    // An Inertia visit can't download: 409 tells the browser to go there itself.
    expect(visit.status).toBe(409);
    expect(visit.headers['x-inertia-location']).toBe(
      `/projects/${home}/export.csv`,
    );

    const csv = await user.agent
      .get(`/projects/${home}/export.csv`)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toBe(
      'Title,Description,Priority,Due date,Due time,Recurrence,Section,Labels',
    );
    expect(csv.text).toContain('Book a plumber');

    const garden = await idOf('project', "name = 'Garden'");
    await user.agent
      .post(`/projects/${garden}/import`)
      .set(user.inertia())
      .attach('file', Buffer.from(csv.text), {
        filename: 'home.csv',
        contentType: 'text/csv',
      })
      .expect(302);
    const imported = await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM task WHERE projectId = ?',
      [garden],
    );
    expect(Number(imported.n)).toBe(csv.text.trim().split('\r\n').length - 1);
  });
});

describe('phase 3: upcoming and completed', () => {
  it('pages Upcoming by the week, with every day in it', async () => {
    const user = await ada();
    const page = (await user.visit('/upcoming')).body;
    expect(page.props.days.data).toHaveLength(7);
    expect(page.props.days.data[0].date).toBe(page.props.today);
    expect(page.scrollProps.days).toMatchObject({
      currentPage: 0,
      nextPage: 1,
      previousPage: null,
    });

    const next = (
      await user.partial('/upcoming?page=1', 'Upcoming/Index', 'days', {
        'X-Inertia-Infinite-Scroll-Merge-Intent': 'append',
      })
    ).body;
    expect(next.props.days.data[0].date > page.props.days.data[6].date).toBe(
      true,
    );
    expect(next.mergeProps).toEqual(['days.data']);
  });

  it('loads older activity 30 at a time, merged under what is there', async () => {
    const user = await ada();
    const page = (await user.visit('/completed')).body;
    expect(page.props.activity).toHaveLength(30);
    expect(page.mergeProps).toEqual(['activity']);
    const older = page.props.older;
    expect(typeof older).toBe('number');

    const more = (
      await user.partial(
        `/completed?before=${older}`,
        'Completed/Index',
        'activity,older',
      )
    ).body;
    expect(more.props.activity[0].id).toBeLessThan(older);
    expect(Object.keys(more.props).sort()).toEqual([
      'activity',
      'errors',
      'older',
    ]);
  });
});

describe('phase 4: filters, labels and search', () => {
  it('checks a filter query live against the server’s own parser', async () => {
    const user = await ada();
    const before = await one('SELECT COUNT(*) AS n FROM filter');
    const bad = await user.agent
      .post('/filters')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'query' })
      .send({ name: '', query: '(today | p1' });
    expect(bad.status).toBe(422);
    expect(bad.body.errors).toEqual({
      query: 'A bracket is opened but never closed.',
    });

    const good = await user.agent
      .post('/filters')
      .set({ Precognition: 'true' })
      .send({ name: 'Urgent today', query: '(today | overdue) & p1' });
    expect(good.status).toBe(204);
    expect(await one('SELECT COUNT(*) AS n FROM filter')).toEqual(before);
  });

  it('shows the tasks a filter matches', async () => {
    const user = await ada();
    const filter = await idOf('filter', "name = 'Priority 1'");
    const page = (await user.visit(`/filters/${filter}`)).body;
    expect(page.props.tasks.length).toBeGreaterThan(0);
    expect(
      page.props.tasks.every((t: { priority: number }) => t.priority === 1),
    ).toBe(true);
  });

  it('searches tasks, projects and labels as JSON', async () => {
    const user = await ada();
    const found = await user.agent
      .get('/search/results')
      .query({ q: 'plumber' })
      .expect(200);
    expect(found.body.tasks.map((t: { title: string }) => t.title)).toContain(
      'Book a plumber',
    );
    const places = await user.agent
      .get('/search/results')
      .query({ q: 'work' })
      .expect(200);
    expect(places.body.projects.map((p: { name: string }) => p.name)).toContain(
      'Work',
    );
    expect(places.body.labels.map((l: { name: string }) => l.name)).toContain(
      'work',
    );
  });
});

describe('phase 5: collaboration', () => {
  it('invites with a signed link that works once, for a guest who signs up', async () => {
    const user = await ada();
    const launch = await idOf('project', "name = 'Todoish launch'");
    await user.agent
      .post(`/projects/${launch}/invitations`)
      .set({ ...user.inertia(), Referer: `/projects/${launch}` })
      .expect(302);
    const link = (
      await user.partial(`/projects/${launch}`, 'Projects/Show', 'share')
    ).body.flash.invitation;
    expect(link).toMatch(/^\/invitations\/\d+\?.*signature=/);

    const guest = browser();
    const html = await guest.agent
      .get(link)
      .set('Accept', 'text/html')
      .expect(200);
    // Server-rendered: the project's name is in the HTML itself.
    expect(html.text).toContain('Todoish launch');
    expect(html.text).toContain('Make an account to join');

    const tampered = link.replace(
      /\/invitations\/(\d+)/,
      (_: string, id: string) => `/invitations/${Number(id) + 1}`,
    );
    const forged = await guest.agent.get(tampered).set('Accept', 'text/html');
    expect(forged.status).toBe(403);

    await guest.agent
      .post(link)
      .set(guest.inertia())
      .send({
        name: 'Margaret Hamilton',
        email: 'margaret@todoish.dev',
        password: 'apollo-eleven',
      })
      .expect(302);
    const joined = (await guest.visit(`/projects/${launch}`)).body;
    expect(joined.props.people.map((p: { name: string }) => p.name)).toContain(
      'Margaret Hamilton',
    );

    const again = await browser().agent.get(link).set('Accept', 'text/html');
    expect(again.status).toBe(403);
  });

  it('polls a shared project for what others changed (deepMerge)', async () => {
    const user = await ada();
    const launch = await idOf('project', "name = 'Todoish launch'");
    const first = (await user.visit(`/projects/${launch}`)).body;
    expect(first.props.changes).toEqual({});
    expect(first.deepMergeProps).toContain('changes');

    const grace = browser();
    await grace.login('grace@todoish.dev');
    const font = await idOf('task', "title = 'Pick a font'");
    // SQLite keeps whole seconds.
    await wait(1100);
    await grace.agent
      .post(`/tasks/${font}/complete`)
      .set(grace.inertia())
      .expect(302);

    const poll = (
      await user.partial(
        `/projects/${launch}`,
        'Projects/Show',
        'changes,cursor',
        {
          'X-Project-Since': first.props.cursor,
        },
      )
    ).body;
    expect(Object.keys(poll.props).sort()).toEqual([
      'changes',
      'cursor',
      'errors',
    ]);
    expect(poll.props.changes[font].completedAt).not.toBeNull();
  });

  it('adds comments with a file, and the dialog polls only new ones', async () => {
    const user = await ada();
    const readme = await idOf('task', "title = 'Write the README'");
    const url = `/inbox?task=${readme}`;
    const before = (
      await user.partial(url, 'Tasks/Inbox', 'comments,commentsCursor')
    ).body;
    expect(before.props.comments).toHaveLength(2);

    await user.agent
      .post(`/tasks/${readme}/comments`)
      .set({
        ...user.inertia(),
        Referer: url,
        'X-Inertia-Error-Bag': 'comment',
      })
      .attach('file', Buffer.from('MZ'), {
        filename: 'tool.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(302);
    const refused = (await user.visit(url)).body;
    expect(refused.props.errors).toEqual({
      comment: { file: 'Images, text, CSV, JSON, PDF and archives only.' },
    });

    await wait(1100);
    await user.agent
      .post(`/tasks/${readme}/comments`)
      .set({ ...user.inertia(), Referer: url })
      .field('body', 'Screenshot attached.')
      .attach('file', Buffer.from('{"ok":true}'), {
        filename: 'notes.json',
        contentType: 'application/json',
      })
      .expect(302);

    const poll = (
      await user.partial(url, 'Tasks/Inbox', 'comments,commentsCursor', {
        'X-Comments-Since': before.props.commentsCursor,
      })
    ).body;
    expect(poll.props.comments).toHaveLength(1);
    expect(poll.props.comments[0]).toMatchObject({
      body: 'Screenshot attached.',
      file: { name: 'notes.json', size: 11 },
    });
    const file = await user.agent
      .get(poll.props.comments[0].file.url)
      .expect(200);
    expect(file.headers['content-disposition']).toBe(
      'attachment; filename="notes.json"',
    );

    // Grace is in the project, so she can see the file; Linus's own
    // inbox is none of her business.
    const grace = browser();
    await grace.login('grace@todoish.dev');
    await grace.agent.get(poll.props.comments[0].file.url).expect(200);
    const keyboard = await idOf('task', "title = 'Try a new keyboard'");
    const refusedTask = await grace.partial(
      `/inbox?task=${keyboard}`,
      'Tasks/Inbox',
      'task',
    );
    expect(refusedTask.status).toBe(403);
  });
});

describe('phase 6: productivity and extras', () => {
  it('paints goals first and sends each block in its own deferred group', async () => {
    const user = await ada();
    const page = (await user.visit('/productivity')).body;
    expect(page.props.goals.dailyGoal).toBe(5);
    expect(page.props.daily).toBeUndefined();
    expect(page.deferredProps).toEqual({
      daily: ['daily'],
      weekly: ['weekly'],
      karma: ['karma'],
    });

    const karma = (
      await user.partial('/productivity', 'Productivity/Index', 'karma')
    ).body;
    expect(karma.props.karma.karma).toBeGreaterThan(50);
    expect(karma.props.karma.trend).toHaveLength(14);

    // Rescued: the failing prop is left out, the response is fine.
    const nap = await user.partial(
      '/productivity?nap=1',
      'Productivity/Index',
      'karma',
    );
    expect(nap.status).toBe(200);
    expect(nap.body.props.karma).toBeUndefined();
    expect(nap.body.rescuedProps).toEqual(['karma']);
  });

  it('checks goals live: a week is at least a day', async () => {
    const user = await ada();
    const response = await user.agent
      .put('/productivity/goals')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'weeklyGoal' })
      .send({ dailyGoal: 10, weeklyGoal: 5, daysOff: [], vacation: false });
    expect(response.status).toBe(422);
    expect(response.body.errors.weeklyGoal).toMatch(/at least the daily goal/);
  });

  it('serves a signed calendar feed that dies when reset', async () => {
    const user = await ada();
    const settings = (await user.visit('/settings')).body;
    const url = new URL(settings.props.integrations.calendarUrl, 'http://x');
    const path = url.pathname + url.search;
    const feed = await request(app.getHttpServer()).get(path).expect(200);
    expect(feed.headers['content-type']).toContain('text/calendar');
    expect(feed.text).toContain('SUMMARY:Prepare the nestjs-mvc talk');

    const forged = path.replace(/\/\d+\.ics/, '/2.ics');
    expect((await request(app.getHttpServer()).get(forged)).status).toBe(403);

    await user.agent
      .post('/settings/calendar/reset')
      .set(user.inertia())
      .expect(302);
    expect((await request(app.getHttpServer()).get(path)).status).toBe(403);
  });

  it('turns an email into an Inbox task through the webhook', async () => {
    const { inboxToken } = await one<{ inboxToken: string }>(
      "SELECT inboxToken FROM user WHERE email = 'ada@todoish.dev'",
    );
    const created = await request(app.getHttpServer())
      .post(`/hooks/inbox/${inboxToken}`)
      .send({ subject: 'Call the bank tomorrow p1', text: 'About the thing.' })
      .expect(201);
    expect(created.body.task).toMatchObject({
      title: 'Call the bank',
      priority: 1,
      project: 'Inbox',
    });
    await request(app.getHttpServer())
      .post('/hooks/inbox/nope')
      .send({ subject: 'x' })
      .expect(404);
  });

  it('encrypts history for a user who asked for it', async () => {
    const user = await ada();
    expect((await user.visit('/today')).body.encryptHistory).toBeFalsy();
    await user.agent
      .put('/settings/privacy')
      .set(user.inertia())
      .send({ encryptHistory: true })
      .expect(303);
    expect((await user.visit('/today')).body.encryptHistory).toBe(true);
    await user.agent
      .put('/settings/privacy')
      .set(user.inertia())
      .send({ encryptHistory: false })
      .expect(303);
  });
});
