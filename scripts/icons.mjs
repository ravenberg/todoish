// Draws the PWA icons from public/favicon.svg. The PNGs are committed, so
// this only runs when the logo changes:
//
//   npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/favicon.svg', 'utf8');

/** The mark on a background, for icons that can't be transparent or get masked. */
const onBackground = (size, scale, background) => {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);
  const mark = svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${background}"/><g transform="translate(${offset} ${offset})">${mark}</g></svg>`;
};

const icons = [
  // Plain: the square on transparent, for browsers and desktops.
  ['icon-192.png', 192, svg.replace('<svg ', '<svg width="192" height="192" ')],
  ['icon-512.png', 512, svg.replace('<svg ', '<svg width="512" height="512" ')],
  // Maskable: Android crops to a circle or squircle, so the mark stays in the
  // middle 80% on the app's warm white.
  ['icon-maskable-512.png', 512, onBackground(512, 0.62, '#fcfaf8')],
  // iOS doesn't do transparency and rounds the corners itself.
  ['apple-touch-icon.png', 180, onBackground(180, 0.78, '#fcfaf8')],
];

for (const [name, size, source] of icons) {
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png()
    .toFile(`public/icons/${name}`);
  console.log(`public/icons/${name}`);
}
