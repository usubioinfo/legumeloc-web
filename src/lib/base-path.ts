const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '/legumeloc';

export const BASE_PATH = configuredBasePath === '/LegumeLoc' ? '/legumeloc' : configuredBasePath;

export function withBasePath(path: string) {
  if (!path.startsWith('/')) throw new Error('Application paths must start with "/".');
  return `${BASE_PATH}${path}`;
}
