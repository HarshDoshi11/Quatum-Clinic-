/** Runtime configuration. The service layer (Phase 2) reads these. */

export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const APP_VERSION = '0.1.0'
