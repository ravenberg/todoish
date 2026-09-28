// Plays a colleague: logs in as Grace and works in the shared "Todoish
// launch" project while you watch it as Ada. Every few seconds she adds a
// task, completes one or leaves a comment, through the same routes the app
// uses. Open the project (or a task in it) and the changes arrive by polling.
//
//   npm run collaborator:demo            # until Ctrl+C
//   npm run collaborator:demo -- --once  # one thing
//
// Project and task ids come straight from the SQLite database.
import Database from 'better-sqlite3';

const url = `http://localhost:${process.env.PORT ?? 3000}`;
const db = new Database(process.env.DATABASE_PATH ?? 'todoish.sqlite', {
  readonly: true,
});
const project = db
  .prepare("SELECT id FROM project WHERE name = 'Todoish launch'")
  .get();
if (!project) {
  console.error('No "Todoish launch" project: start the app once so it seeds.');
  process.exit(1);
}
const openTasks = () =>
  db
    .prepare(
      'SELECT id, title FROM task WHERE projectId = ? AND completedAt IS NULL AND deletedAt IS NULL AND parentId IS NULL',
    )
    .all(project.id);

/** Cookies, like a browser keeps them. */
const jar = new Map();
function remember(response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const [name, ...value] = pair.split('=');
    jar.set(name, value.join('='));
  }
}
const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

/**
 * A form post with what a browser would send: the cookies, the XSRF token
 * nestjs-mvc checks, and an Origin on this site.
 */
async function post(path, body) {
  const response = await fetch(url + path, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      Origin: url,
      Referer: `${url}/projects/${project.id}`,
      Cookie: cookies(),
      'X-XSRF-TOKEN': decodeURIComponent(jar.get('XSRF-TOKEN') ?? ''),
    },
    body: JSON.stringify(body),
  });
  remember(response);
  if (response.status >= 400)
    throw new Error(`${path} answered ${response.status}`);
}

remember(await fetch(`${url}/login`));
await post('/login', { email: 'grace@todoish.dev', password: 'password' });
console.log(`Logged in as Grace. Watch ${url}/projects/${project.id} as Ada.`);

const IDEAS = [
  'Proofread the landing page tomorrow p2',
  'Ask Linus about the SSL certificate p1',
  'Make the logo 3% more crooked',
  'Screenshot the board view for the post',
  'Order stickers, ish p3',
  'Check the app on an old phone tomorrow',
];
const REMARKS = [
  'On it.',
  'Done-ish. Can someone double check?',
  'This one is bigger than it looks.',
  'Love it. Ship it.',
  'Moving this to next week, sorry!',
];
const pick = (items) => items[Math.floor(Math.random() * items.length)];

async function tick() {
  const tasks = openTasks();
  const roll = Math.random();
  if (roll < 0.35 || tasks.length < 3) {
    const text = pick(IDEAS);
    await post('/tasks', { text, defaultProjectId: project.id });
    console.log(`+ added     ${text}`);
  } else if (roll < 0.65) {
    const task = pick(tasks);
    await post(`/tasks/${task.id}/complete`, {});
    console.log(`✓ completed ${task.title}`);
  } else {
    const task = pick(tasks);
    const body = pick(REMARKS);
    await post(`/tasks/${task.id}/comments`, { body });
    console.log(`💬 commented on ${task.title}: ${body}`);
  }
}

if (process.argv.includes('--once')) {
  await tick();
} else {
  for (;;) {
    await tick().catch((error) => console.error(error.message));
    await new Promise((resolve) =>
      setTimeout(resolve, 4000 + Math.random() * 4000),
    );
  }
}
