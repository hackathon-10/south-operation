import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/** מטמון Emotion שהופך את כל ה-CSS ל-RTL (§10.1 - כל המערכת בעברית וב-RTL). */
export const rtlCache = createCache({
  key: 'south-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});
