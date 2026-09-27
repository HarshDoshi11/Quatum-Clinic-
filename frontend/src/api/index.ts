/**
 * The one API entry point for the app. USE_MOCK (VITE_USE_MOCK, default true)
 * swaps in the mock implementation; otherwise requests go to VITE_API_URL.
 */
import { USE_MOCK } from '@/config'
import { mockApi } from '@/mocks/mockApi'
import { httpApi } from './http'
import type { Api } from './types'

export const api: Api = USE_MOCK ? mockApi : httpApi

export { ApiError, isAbortError } from './errors'
export type { Api, RequestOptions } from './types'
export { useResource, type Resource } from './useResource'
