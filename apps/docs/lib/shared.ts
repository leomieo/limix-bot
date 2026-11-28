export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';
export const appName = 'Limix Bot Docs';
export const siteUrl = process.env.DOCS_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000');

export const gitConfig = {
  user: 'leomieo',
  repo: 'limix-bot',
  branch: 'main',
};
