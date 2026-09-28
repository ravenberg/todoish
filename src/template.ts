import type { PageObject, TemplateContext } from 'nestjs-mvc';

/**
 * The HTML around every page. The manifest and the icons make Todoish
 * installable; `viewport-fit=cover` lets the tab bar sit on the home
 * indicator's safe area in standalone mode. The inline script sets the colour
 * scheme before anything paints, so a dark-mode user never sees a white flash.
 */
export function template(_page: PageObject, ctx: TemplateContext): string {
  const nonce = ctx.nonce ? ` nonce="${ctx.nonce}"` : '';
  return `<!DOCTYPE html>
<html lang="en" data-mantine-color-scheme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fcfaf8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1f1f1f" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Todoish">
<meta name="description" content="Todoish: like Todoist, but ish. A demo app for nestjs-mvc.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<title>Todoish</title>
<script${nonce}>try{var s=localStorage.getItem('mantine-color-scheme-value');var d=s==='dark'||((!s||s==='auto')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-mantine-color-scheme',d?'dark':'light')}catch(e){}</script>
${ctx.assets()}
${ctx.head()}
</head>
<body>${ctx.body()}</body>
</html>`;
}
