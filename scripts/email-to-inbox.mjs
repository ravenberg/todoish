// Plays your mail provider: posts a forwarded email to Ada's email-to-inbox
// webhook, the way Mailgun or Postmark would. The subject is read like quick
// add, so the task arrives with its date and priority.
//
//   npm run email:demo
//   npm run email:demo -- "Renew the car insurance friday p1"
//
// The token comes straight from the SQLite database.
import Database from 'better-sqlite3';

const url = `http://localhost:${process.env.PORT ?? 3000}`;
const db = new Database(process.env.DATABASE_PATH ?? 'todoish.sqlite', {
  readonly: true,
});
const user = db
  .prepare("SELECT inboxToken FROM user WHERE email = 'ada@todoish.dev'")
  .get();
if (!user) {
  console.error('No Ada yet: start the app once so it seeds.');
  process.exit(1);
}

const SUBJECTS = [
  'Fwd: Your dentist appointment tomorrow 9am',
  'Invoice #4521 is due friday p1',
  'Re: Book club next week @reading',
  'Fwd: Parking permit renewal in 3 days p2',
];
const subject =
  process.argv[2] ?? SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];

const response = await fetch(`${url}/hooks/inbox/${user.inboxToken}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ subject, text: 'Sent from my phone, ish.' }),
});
console.log(response.status, JSON.stringify(await response.json()));
