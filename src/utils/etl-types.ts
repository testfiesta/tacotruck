export interface ETLConfig {
  name: string
  type: 'api' | 'junit' | 'json'
  base_path?: string
  auth?: {
    type: string
    location: 'header' | 'query' | 'body'
    key?: string
    payload?: string
  }
  requests_per_second?: number
  sourceThrottle?: number
  sourceThrottleTime?: number
  endpoints?: Record<string, {
    path?: string
    bulk_path?: string
    single_path?: string
    data_key?: string
    include_source?: boolean
    update_key?: string
    payload_key?: string
    throttle?: number
    throttleTime?: number
  }>
  source?: Record<string, {
    target_type: string
    [key: string]: unknown
  }>
  target?: Record<string, unknown>
  direction: string
  integration: string
  throttleCap: number
  endpointSet: string[]
  offsets: Record<string, number>
  baseUrl?: string
  typeConfig?: {
    name: string
    type: string
    auth?: {
      type: string
      [key: string]: any
    }
    requests_per_second?: number
    source?: Record<string, any>
    target?: Record<string, any>
    multi_target?: Record<string, any>
    index?: Record<string, any>
    get?: Record<string, any>
    overrides?: Record<string, any>
    [key: string]: any
  }
  ignoreConfig?: Record<string, Record<string, any>>
  source_control?: Record<string, any>
}

export interface ResponseData {
  data: any | any[]
  [key: string]: any
}
