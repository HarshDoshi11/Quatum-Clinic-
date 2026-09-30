/** Runtime configuration. The service layer (Phase 2) reads these. */

export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false'

/** Base for API calls. Relative by default: in production FastAPI serves the app and the API from one origin;
 * in `npm run dev`, Vite proxies /api to the backend (vite.config.ts). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '/api'

export const APP_VERSION = '0.1.0'
