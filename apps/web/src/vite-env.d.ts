/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** כתובת ה-API. משתנה ציבורי - אין להכניס אליו סודות. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'stylis-plugin-rtl' {
  import type { Middleware } from 'stylis';
  const rtlPlugin: Middleware;
  export default rtlPlugin;
}
