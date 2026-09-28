import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource, type EntityManager } from 'typeorm';
import { newInboxToken } from '../auth/accounts.service.js';
import { hashPassword } from '../auth/passwords.js';
import { type Day, addDays, nextWeekday, today } from '../common/dates.js';
import { firstOccurrence } from '../tasks/recurrence.js';
import {
  Activity,
  Comment,
  Filter,
  Label,
  Project,
  ProjectMember,
  Section,
  Task,
  User,
} from './entities/index.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** The same "random" history on every reset. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TaskSeed {
  title: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4;
  /** Days from today; a recurrence picks its own first date. */
  due?: number;
  day?: Day;
  time?: string;
  recurrence?: string;
  labels?: string[];
  section?: string;
  assignee?: User;
  by?: User;
  subtasks?: (string | { title: string; done: boolean })[];
  comments?: { by: User; body: string; hoursAgo: number; file?: string }[];
}

interface Seeded {
  project: Project;
  sections: Map<string, Section>;
}

const ADA_LABELS: [string, string][] = [
  ['work', 'blue'],
  ['errands', 'orange'],
  ['waiting', 'grey'],
  ['quick', 'lime_green'],
  ['reading', 'violet'],
  ['calls', 'teal'],
];

const HISTORY = [
  'Answer the email from the accountant',
  'Clean the coffee machine',
  'Merge the dependabot PRs',
  'Send the meeting notes',
  'Take out the recycling',
  'Update the roadmap',
  'Call mum',
  'Order printer ink',
  'Review the pull request',
  'Book the train tickets',
  'Tidy the desk, ish',
  'Plan next week',
  'Pay the electricity bill',
  'Water the plants',
  'Reply to the recruiter, politely',
  'Fix the flaky test',
  'Go for a run',
  'Write the changelog',
  'Back up the laptop',
  'Prepare the slides',
];

const SEEDED_FILES: Record<string, string> = {
  'Caddyfile.txt': `todoish.ravenberg.dev {
\tencode zstd gzip
\treverse_proxy 127.0.0.1:3003
}
`,
};

function firstOfNextMonth(day: Day) {
  const [y, m] = day.split('-').map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * Fills an empty database with three people, their projects and a couple of
 * months of history, so the demo has something to show on first start.
 * Dates are relative to today, so the demo is always "now". Everyone's
 * password is `password`.
 */
@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeeder.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onApplicationBootstrap() {
    if ((await this.db.getRepository(User).count()) > 0) return;
    await this.db.transaction((db) => this.seed(db));
    this.logger.log('Seeded the demo: log in as ada@todoish.dev / password.');
  }

  private async seed(db: EntityManager) {
    const now = today();
    const passwordHash = await hashPassword('password');
    const person = (name: string, email: string) =>
      db.save(
        db.create(User, {
          name,
          email,
          passwordHash,
          inboxToken: newInboxToken(),
        }),
      );
    const ada = await person('Ada Lovelace', 'ada@todoish.dev');
    const grace = await person('Grace Hopper', 'grace@todoish.dev');
    const linus = await person('Linus Torvalds', 'linus@todoish.dev');

    let position = 0;
    const project = async (
      owner: User,
      name: string,
      options: Omit<Partial<Project>, 'members' | 'sections'> & {
        members?: User[];
        favorite?: boolean;
        sections?: string[];
      } = {},
    ): Promise<Seeded> => {
      const {
        members = [],
        favorite = false,
        sections = [],
        ...fields
      } = options;
      const saved = await db.save(
        db.create(Project, { name, owner, position: ++position, ...fields }),
      );
      for (const user of [owner, ...members])
        await db.save(
          db.create(ProjectMember, {
            project: saved,
            user,
            favorite: favorite,
          }),
        );
      const bySection = new Map<string, Section>();
      for (const [i, section] of sections.entries())
        bySection.set(
          section,
          await db.save(
            db.create(Section, {
              name: section,
              project: saved,
              position: i + 1,
            }),
          ),
        );
      return { project: saved, sections: bySection };
    };

    const labels = new Map<string, Label>();
    for (const [name, color] of ADA_LABELS)
      labels.set(
        name,
        await db.save(db.create(Label, { name, color, owner: ada })),
      );

    let taskPosition = 0;
    const tasks = async (target: Seeded, seeds: TaskSeed[], owner: User) => {
      for (const seed of seeds) {
        const dueDate =
          seed.day ??
          (seed.recurrence
            ? firstOccurrence(seed.recurrence, now)
            : seed.due !== undefined
              ? addDays(now, seed.due)
              : null);
        const task = await db.save(
          db.create(Task, {
            title: seed.title,
            description: seed.description ?? '',
            priority: seed.priority ?? 4,
            dueDate,
            dueTime: dueDate ? (seed.time ?? null) : null,
            recurrence: seed.recurrence ?? null,
            project: target.project,
            section: seed.section ? target.sections.get(seed.section)! : null,
            labels: (seed.labels ?? []).map((name) => labels.get(name)!),
            assignee: seed.assignee ?? null,
            createdBy: seed.by ?? owner,
            position: ++taskPosition,
          }),
        );
        for (const sub of seed.subtasks ?? []) {
          const { title, done } =
            typeof sub === 'string' ? { title: sub, done: false } : sub;
          await db.save(
            db.create(Task, {
              title,
              project: target.project,
              section: task.section,
              parent: task,
              createdBy: owner,
              position: ++taskPosition,
              completedAt: done ? new Date(Date.now() - 20 * HOUR) : null,
            }),
          );
        }
        for (const comment of seed.comments ?? []) {
          let file: Partial<Comment> = {};
          if (comment.file) {
            const dir = join('comments', String(task.id));
            const storageKey = join(dir, 'seeded');
            const content = SEEDED_FILES[comment.file] ?? '';
            await mkdir(join(process.env.STORAGE_PATH ?? 'storage', dir), {
              recursive: true,
            });
            await writeFile(
              join(process.env.STORAGE_PATH ?? 'storage', storageKey),
              content,
            );
            file = {
              filename: comment.file,
              mimeType: 'text/plain',
              size: Buffer.byteLength(content),
              storageKey,
            };
          }
          await db.save(
            db.create(Comment, {
              task,
              author: comment.by,
              body: comment.body,
              createdAt: new Date(Date.now() - comment.hoursAgo * HOUR),
              ...file,
            }),
          );
        }
      }
    };

    // Everyone's Inbox.
    const inbox = new Map<User, Seeded>();
    for (const user of [ada, grace, linus])
      inbox.set(user, await project(user, 'Inbox', { isInbox: true }));

    await tasks(
      inbox.get(ada)!,
      [
        {
          title: 'Call the dentist about that thing',
          priority: 2,
          due: 0,
          labels: ['calls', 'quick'],
        },
        { title: 'Buy oat milk', labels: ['errands', 'quick'], due: 0 },
        {
          title: 'Read the nestjs-mvc docs, properly this time',
          labels: ['reading'],
        },
        {
          title: 'Figure out what the “ish” in Todoish means',
          description: 'Philosophically.',
        },
        { title: 'Renew passport', priority: 2, due: 12 },
        {
          title: 'Reply to Grace about the housewarming',
          due: 1,
          labels: ['quick'],
        },
      ],
      ada,
    );

    const work = await project(ada, 'Work', {
      color: 'blue',
      favorite: true,
      sections: ['This week', 'Waiting on', 'Someday'],
    });
    await tasks(
      work,
      [
        {
          title: 'Prepare the nestjs-mvc talk',
          description: 'Show, don’t tell: one app, every feature, X-ray on.',
          priority: 1,
          due: 0,
          time: '14:00',
          labels: ['work'],
          section: 'This week',
          subtasks: [
            { title: 'Write the outline', done: true },
            { title: 'Pick nine features to show', done: true },
            'Record a backup of the demo',
            'Rehearse with a timer',
          ],
        },
        {
          title: 'Review Linus’s pull request',
          priority: 2,
          due: 0,
          labels: ['work'],
          section: 'This week',
        },
        {
          title: 'Expense report',
          priority: 3,
          due: -2,
          labels: ['work'],
          section: 'This week',
        },
        {
          title: 'Send the invoice to Analytical Engines Ltd',
          priority: 2,
          due: 1,
          labels: ['work'],
          section: 'This week',
        },
        {
          title: 'Stand-up',
          recurrence: 'every weekday',
          time: '09:30',
          labels: ['work'],
          section: 'This week',
        },
        {
          title: '1:1 with Grace',
          recurrence: 'every tuesday',
          time: '10:00',
          labels: ['work', 'calls'],
          section: 'This week',
        },
        {
          title: 'Weekly review',
          recurrence: 'every friday',
          time: '16:00',
          priority: 2,
          section: 'This week',
        },
        {
          title: 'Laptop replacement from IT',
          labels: ['waiting'],
          section: 'Waiting on',
        },
        {
          title: 'Feedback on the design doc',
          labels: ['waiting'],
          due: 3,
          section: 'Waiting on',
        },
        { title: 'Learn Rust (for real this time)', section: 'Someday' },
        {
          title: 'Write a blog post about live validation',
          section: 'Someday',
          labels: ['work'],
        },
      ],
      ada,
    );

    const home = await project(ada, 'Home', { color: 'green', favorite: true });
    await tasks(
      home,
      [
        { title: 'Book a plumber', priority: 1, due: -1, labels: ['calls'] },
        { title: 'Water the plants', recurrence: 'every 3 days' },
        {
          title: 'Pay rent',
          recurrence: 'every month',
          day: firstOfNextMonth(now),
          priority: 2,
        },
        { title: 'Fix the squeaky door', priority: 3, due: 4 },
        {
          title: 'Grocery run',
          labels: ['errands'],
          day: nextWeekday(now, 6, true),
        },
        {
          title: 'Take the bike in for a service',
          labels: ['errands'],
          due: 9,
        },
      ],
      ada,
    );

    const reading = await project(ada, 'Reading list', {
      color: 'violet',
      viewStyle: 'board',
      sections: ['To read', 'Reading', 'Finished, ish'],
    });
    await tasks(
      reading,
      [
        {
          title: 'The Mythical Man-Month',
          section: 'To read',
          labels: ['reading'],
        },
        {
          title: 'Designing Data-Intensive Applications',
          section: 'Reading',
          labels: ['reading'],
        },
        {
          title: 'Four Thousand Weeks',
          section: 'Reading',
          labels: ['reading'],
          priority: 3,
        },
        {
          title: 'Getting Things Done (the irony is not lost on me)',
          section: 'Finished, ish',
          labels: ['reading'],
        },
        {
          title: 'The Pragmatic Programmer',
          section: 'To read',
          labels: ['reading'],
        },
      ],
      ada,
    );

    const fitness = await project(ada, 'Fitness', { color: 'orange' });
    await tasks(
      fitness,
      [
        { title: 'Run 5k', recurrence: 'every 2 days', time: '07:30' },
        {
          title: 'Stretch for ten minutes',
          recurrence: 'every day',
          labels: ['quick'],
        },
        { title: 'Sign up for the half marathon', priority: 2, due: 6 },
      ],
      ada,
    );

    const launch = await project(ada, 'Todoish launch', {
      color: 'berry_red',
      viewStyle: 'board',
      favorite: true,
      members: [grace, linus],
      sections: ['To do', 'Doing', 'Done, ish'],
    });
    await tasks(
      launch,
      [
        {
          title: 'Write the README',
          description: 'Human voice. No dashes. A “Where to look” table.',
          priority: 2,
          due: 0,
          section: 'Doing',
          assignee: ada,
          comments: [
            {
              by: grace,
              body: 'Can we put “ish” in the title? Please?',
              hoursAgo: 26,
            },
            { by: ada, body: 'We can and we will.', hoursAgo: 25 },
          ],
        },
        {
          title: 'Set up todoish.ravenberg.dev',
          priority: 2,
          due: 1,
          section: 'Doing',
          assignee: linus,
          by: linus,
          comments: [
            {
              by: linus,
              body: 'Caddy config for the proxy, for whoever runs the server next.',
              hoursAgo: 5,
              file: 'Caddyfile.txt',
            },
          ],
        },
        {
          title: 'Record the demo video',
          priority: 1,
          due: 3,
          section: 'To do',
          assignee: ada,
        },
        {
          title: 'Design the askew logo',
          section: 'Done, ish',
          assignee: grace,
          by: grace,
          description: 'Crooked on purpose. Mostly.',
        },
        {
          title: 'Tweet about it, ish',
          due: 7,
          section: 'To do',
          assignee: grace,
          by: grace,
        },
        {
          title: 'Make the service worker leave pages alone',
          priority: 2,
          due: 2,
          section: 'To do',
          assignee: linus,
          by: linus,
        },
        {
          title: 'Pick a font',
          section: 'To do',
          assignee: grace,
          by: grace,
          priority: 3,
        },
        { title: 'Write the launch post', due: 5, section: 'To do' },
      ],
      ada,
    );

    const moving = await project(grace, 'Moving house', {
      color: 'teal',
      members: [ada],
      sections: ['Before', 'Moving day', 'After'],
    });
    await tasks(
      moving,
      [
        {
          title: 'Buy tape and boxes',
          section: 'Before',
          due: 2,
          assignee: ada,
        },
        {
          title: 'Book the van',
          section: 'Before',
          priority: 1,
          due: 1,
          assignee: ada,
          comments: [
            {
              by: grace,
              body: 'The big one. We have a piano now, apparently.',
              hoursAgo: 3,
            },
          ],
        },
        { title: 'Change address at the bank', section: 'After', due: 14 },
        {
          title: 'Housewarming party',
          section: 'After',
          due: 16,
          priority: 2,
          description: 'Bring snacks. Or a lamp.',
        },
        {
          title: 'Unplug the fridge the night before',
          section: 'Moving day',
          due: 10,
        },
      ],
      grace,
    );

    await tasks(
      inbox.get(grace)!,
      [
        { title: 'Fix the COBOL printer driver', priority: 2, due: 0 },
        { title: 'Order nanosecond wires for the talk', due: 3 },
      ],
      grace,
    );
    await tasks(
      inbox.get(linus)!,
      [
        {
          title: 'Reply to that mailing list thread (nicely)',
          priority: 1,
          due: 0,
        },
        { title: 'Try a new keyboard', due: 5 },
      ],
      linus,
    );

    await db.save([
      db.create(Filter, {
        name: 'Priority 1',
        query: 'p1',
        color: 'red',
        owner: ada,
        position: 1,
      }),
      db.create(Filter, {
        name: 'Assigned to me',
        query: 'assigned to me',
        color: 'blue',
        owner: ada,
        position: 2,
      }),
      db.create(Filter, {
        name: 'Quick wins',
        query: '@quick & !overdue',
        color: 'lime_green',
        owner: ada,
        position: 3,
      }),
      db.create(Filter, {
        name: 'Work this week',
        query: '7 days & #Work',
        color: 'grape',
        owner: ada,
        position: 4,
      }),
    ]);

    const adaProjects = [inbox.get(ada)!, work, home, fitness, launch].map(
      (s) => s.project,
    );
    await this.history(db, ada, adaProjects, 60, 11);
    await this.history(db, grace, [launch.project, moving.project], 20, 23);
    await this.history(db, linus, [launch.project], 14, 37);
  }

  /**
   * A few weeks of finished tasks: fewer at weekends, a lazy day now and
   * then, so the charts have a shape and the streak something to count.
   * Nothing today: that's for the demo.
   */
  private async history(
    db: EntityManager,
    user: User,
    projects: Project[],
    days: number,
    seed: number,
  ) {
    const rand = random(seed);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    for (let d = days; d >= 1; d--) {
      const date = new Date(midnight.getTime() - d * DAY + 12 * HOUR);
      const weekend = [0, 6].includes(date.getDay());
      const count = weekend
        ? Math.floor(rand() * 3)
        : rand() < 0.12
          ? 1
          : 5 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        const project = projects[Math.floor(rand() * projects.length)];
        const at = new Date(date);
        at.setHours(8 + Math.floor(rand() * 11), Math.floor(rand() * 60), 0, 0);
        const priority = (1 + Math.floor(rand() * 4)) as 1 | 2 | 3 | 4;
        const title = HISTORY[Math.floor(rand() * HISTORY.length)];
        const task = await db.save(
          db.create(Task, {
            title,
            priority,
            project,
            createdBy: user,
            completedAt: at,
            createdAt: new Date(at.getTime() - 2 * DAY),
          }),
        );
        await db.save(
          db.create(Activity, {
            kind: 'completed',
            actor: user,
            project,
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            createdAt: at,
          }),
        );
      }
    }
  }
}
