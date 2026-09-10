import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { SecurityScheme } from './parser.js';

export type SecuritySchemeConfig =
  | string
  | {
      token?: string;
      value?: string;
      username?: string;
      password?: string;
      header?: string;
      query?: string;
      cookie?: string;
      [key: string]: unknown;
    };

export interface AuthConfig {
  headers?: Record<string, string>;
  bearerToken?: string;
  apiKey?: {
    name: string;
    value: string;
    in: 'header' | 'query' | 'cookie';
  };
  basicAuth?:
    | {
        username?: string;
        password?: string;
      }
    | string;
  securitySchemes?: Record<string, SecuritySchemeConfig>;
  allowedExternalHosts?: string[];
  allowCrossOriginAuth?: boolean;
}

export interface SandboxAuthConfig {
  bearerToken?: string;
  headers?: Record<string, string>;
  apiKey?: {
    name: string;
    value: string;
    in?: 'header' | 'query' | 'cookie';
  };
  customFields?: Array<{ key: string; value: string }>;
}

export interface AsyncPollResult {
  response: AxiosResponse;
  timedOut: boolean;
}

export interface ResilientHttpClientOptions {
  baseUrl: string;
  auth?: AuthConfig;
  timeout?: number;
  maxRetries?: number;
  autoPoll202?: boolean;
  specSecuritySchemes?: Record<string, SecurityScheme>;
}

export interface HttpRequestConfig extends AxiosRequestConfig {
  securityRequirement?: Array<Record<string, string[]>>;
  specSecuritySchemes?: Record<string, SecurityScheme>;
}

export interface HttpResponseResult {
  status: number;
  statusText: string;
  headers: Record<string, unknown>;
  data: unknown;
  contentType?: string;
  isError: boolean;
  errorMessage?: string;
  isPollingTimeout?: boolean;
}

export interface SerializedRequestParameters {
  path: string;
  queryParams: Record<string, unknown>;
  headerParams: Record<string, string>;
  cookieParams: Record<string, string>;
}
