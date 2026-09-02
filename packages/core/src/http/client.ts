import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthConfig, applyAuth } from './auth.js';
import { parseRetryAfter, sleepWithJitter } from './retry.js';
import { pollAsyncJob } from './async202.js';

export interface ResilientHttpClientOptions {
  baseUrl: string;
  auth?: AuthConfig;
  timeout?: number;
  maxRetries?: number;
  autoPoll202?: boolean;
}

export interface HttpResponseResult {
  status: number;
  statusText: string;
  headers: Record<string, any>;
  data: any;
  contentType?: string;
  isError: boolean;
  errorMessage?: string;
}

export class ResilientHttpClient {
  private baseUrl: string;
  private auth?: AuthConfig;
  private timeout: number;
  private maxRetries: number;
  private autoPoll202: boolean;

  constructor(options: ResilientHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth = options.auth;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.autoPoll202 = options.autoPoll202 !== false;
  }

  public async request(config: AxiosRequestConfig): Promise<HttpResponseResult> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      ...(config.headers as any),
    };
    const queryParams: Record<string, any> = { ...config.params };

    applyAuth(headers, queryParams, this.auth);

    let url = config.url || '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${this.baseUrl}/${url.replace(/^\//, '')}`;
    }

    const axiosConfig: AxiosRequestConfig = {
      ...config,
      url,
      headers,
      params: queryParams,
      timeout: this.timeout,
      validateStatus: () => true, // Don't throw on 4xx/5xx so we can format structured recovery
      responseType: config.responseType || 'json',
    };

    let attempts = 0;
    let response: AxiosResponse | undefined;

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        response = await axios(axiosConfig);

        if (response) {
          // Handle 429 Rate Limit & 503 Service Unavailable retries
          if ((response.status === 429 || response.status === 503) && attempts < this.maxRetries) {
            const retryAfterMs = parseRetryAfter(response.headers?.['retry-after']);
            const delay = retryAfterMs !== null ? retryAfterMs : Math.min(1000 * Math.pow(2, attempts), 5000);
            await sleepWithJitter(delay);
            continue;
          }

          // Handle 202 Accepted auto-polling
          if (response.status === 202 && this.autoPoll202) {
            response = await pollAsyncJob(response, this.baseUrl, axiosConfig);
          }
        }

        break;
      } catch (err: any) {
        if (attempts >= this.maxRetries) {
          return {
            status: 500,
            statusText: 'Internal Network Error',
            headers: {},
            data: null,
            isError: true,
            errorMessage: `Network request failed after ${attempts} attempts: ${err.message}`,
          };
        }
        await sleepWithJitter(500 * attempts);
      }
    }

    if (!response) {
      return {
        status: 500,
        statusText: 'No Response',
        headers: {},
        data: null,
        isError: true,
        errorMessage: 'No response received from remote server',
      };
    }

    const isError = response.status >= 400;
    let errorMessage: string | undefined;

    if (isError) {
      const errorDetail =
        typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
      errorMessage = `[HTTP ${response.status} ${response.statusText}] ${errorDetail}`;
    }

    const contentType = response.headers?.['content-type'] ? String(response.headers['content-type']) : undefined;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      contentType,
      isError,
      errorMessage,
    };
  }
}
