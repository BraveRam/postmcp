import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { sleepWithJitter } from './retry.js';
import { isSameOriginOrAllowed } from './auth.js';

export interface AsyncPollResult {
  response: AxiosResponse;
  timedOut: boolean;
}

export async function pollAsyncJob(
  initialResponse: AxiosResponse,
  baseUrl: string,
  requestConfig: AxiosRequestConfig,
  maxTimeoutMs: number = 15000
): Promise<AsyncPollResult> {
  const locationHeader = initialResponse.headers['location'] || initialResponse.headers['status-uri'];
  let statusUrl: string | null = null;

  if (locationHeader) {
    statusUrl = locationHeader.startsWith('http')
      ? locationHeader
      : `${baseUrl.replace(/\/$/, '')}/${locationHeader.replace(/^\//, '')}`;
  } else if (initialResponse.data && typeof initialResponse.data === 'object') {
    const jobData = initialResponse.data;
    if (jobData.status_url && typeof jobData.status_url === 'string') {
      statusUrl = jobData.status_url.startsWith('http')
        ? jobData.status_url
        : `${baseUrl.replace(/\/$/, '')}/${jobData.status_url.replace(/^\//, '')}`;
    }
  }

  if (!statusUrl) {
    // No valid status endpoint found, return initial 202 response
    return { response: initialResponse, timedOut: false };
  }

  // Cross-origin auth header stripping (Finding 19)
  const pollHeaders: Record<string, any> = { ...requestConfig.headers };
  if (!isSameOriginOrAllowed(statusUrl, baseUrl)) {
    delete pollHeaders['Authorization'];
    delete pollHeaders['authorization'];
    delete pollHeaders['Cookie'];
  }

  const startTime = Date.now();
  let delay = 500;

  while (Date.now() - startTime < maxTimeoutMs) {
    await sleepWithJitter(delay);

    try {
      const statusRes = await axios.get(statusUrl, {
        headers: pollHeaders,
        timeout: 5000,
        validateStatus: () => true,
      });

      if (statusRes.status === 200 || statusRes.status === 201) {
        const data = statusRes.data;
        if (data && typeof data === 'object') {
          const status = (data.status || data.state || '').toLowerCase();
          if (
            status === 'completed' ||
            status === 'succeeded' ||
            status === 'finished' ||
            status === 'success' ||
            status === 'done'
          ) {
            return { response: statusRes, timedOut: false };
          }
          if (status === 'failed' || status === 'error' || status === 'cancelled') {
            return { response: statusRes, timedOut: false };
          }
        } else {
          return { response: statusRes, timedOut: false };
        }
      }

      delay = Math.min(delay * 1.5, 3000);
    } catch {
      break;
    }
  }

  // Timed out polling
  return { response: initialResponse, timedOut: true };
}
