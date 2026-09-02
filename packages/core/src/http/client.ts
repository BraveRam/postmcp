import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthConfig, applyAuth } from './auth.js';
import { parseRetryAfter, sleepWithJitter, isIdempotentMethod } from './retry.js';
import { pollAsyncJob } from './async202.js';

import { SecurityScheme } from '../parser/types.js';

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
  headers: Record<string, any>;
  data: any;
  contentType?: string;
  isError: boolean;
  errorMessage?: string;
  isPollingTimeout?: boolean;
}

export class ResilientHttpClient {
  private baseUrl: string;
  private auth?: AuthConfig;
  private timeout: number;
  private maxRetries: number;
  private autoPoll202: boolean;
  private specSecuritySchemes?: Record<string, SecurityScheme>;

  constructor(options: ResilientHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth = options.auth;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.autoPoll202 = options.autoPoll202 !== false;
    this.specSecuritySchemes = options.specSecuritySchemes;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getAuthConfig(): AuthConfig | undefined {
    return this.auth;
  }

  public async request(config: HttpRequestConfig): Promise<HttpResponseResult> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      ...(config.headers as any),
    };
    const queryParams: Record<string, any> = { ...config.params };

    let url = config.url || '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${this.baseUrl}/${url.replace(/^\//, '')}`;
    }

    // SSRF & Credential Protection (Finding 3) with per-operation security enforcement
    const specSchemes = config.specSecuritySchemes || this.specSecuritySchemes;
    applyAuth(headers, queryParams, this.auth, url, this.baseUrl, config.securityRequirement, specSchemes);

    // Dynamic responseType handling: always fetch as arraybuffer for binary/image or text/json (Finding 12)
    const axiosConfig: AxiosRequestConfig = {
      ...config,
      url,
      headers,
      params: queryParams,
      timeout: this.timeout,
      validateStatus: () => true, // Don't throw on 4xx/5xx so we format structured recovery
      responseType: config.responseType || 'arraybuffer',
    };

    let attempts = 0;
    let response: AxiosResponse | undefined;
    let isPollingTimeout = false;
    const method = (config.method || 'GET').toUpperCase();
    const canRetry = isIdempotentMethod(method, headers);

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        response = await axios(axiosConfig);

        if (response) {
          // Retry on 429, 502, 503 if method is idempotent (Finding 20)
          if ((response.status === 429 || response.status === 502 || response.status === 503) && canRetry && attempts < this.maxRetries) {
            const retryAfterMs = parseRetryAfter(response.headers?.['retry-after']);
            const delay = retryAfterMs !== null ? retryAfterMs : Math.min(1000 * Math.pow(2, attempts), 5000);
            await sleepWithJitter(delay);
            continue;
          }

          // Handle 202 Accepted auto-polling (Finding 19)
          if (response.status === 202 && this.autoPoll202) {
            const pollResult = await pollAsyncJob(response, this.baseUrl, axiosConfig);
            response = pollResult.response;
            if (pollResult.timedOut) {
              isPollingTimeout = true;
            }
          }
        }

        break;
      } catch (err: any) {
        if (!canRetry || attempts >= this.maxRetries) {
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

    const contentType = response.headers?.['content-type'] ? String(response.headers['content-type']) : '';
    let parsedData: any = response.data;

    // Decode response body based on content-type (Finding 12)
    if (Buffer.isBuffer(response.data) || response.data instanceof ArrayBuffer) {
      const buffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);

      if (contentType.includes('application/json')) {
        try {
          parsedData = JSON.parse(buffer.toString('utf-8'));
        } catch {
          parsedData = buffer.toString('utf-8');
        }
      } else if (
        contentType.includes('text/') ||
        contentType.includes('application/xml') ||
        contentType.includes('application/yaml') ||
        contentType.includes('application/javascript')
      ) {
        parsedData = buffer.toString('utf-8');
      } else {
        // Binary / Image / PDF
        parsedData = buffer;
      }
    }

    const isError = response.status >= 400;
    let errorMessage: string | undefined;

    if (isError) {
      const errorDetail =
        typeof parsedData === 'object' && !Buffer.isBuffer(parsedData)
          ? JSON.stringify(parsedData)
          : String(parsedData);
      errorMessage = `[HTTP ${response.status} ${response.statusText}] ${errorDetail}`;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: parsedData,
      contentType,
      isError,
      errorMessage,
      isPollingTimeout: isPollingTimeout ? true : undefined,
    };
  }
}
