import { createDirectus, rest, authentication } from '@directus/sdk';

// Using relative path because Vite proxies /hdjskefs45 to localhost:8080
export const DIRECTUS_URL = '/hdjskefs45';

export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json', { autoRefresh: true }))
  .with(rest());
