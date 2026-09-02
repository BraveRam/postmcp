import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { sleepWithJitter } from './retry.js';
import { isSameOriginOrAllowed, stripSensitiveAuth } from './auth.js';

export interface AsyncPollResult {
  response: AxiosResponse;
  timedOut: boolean;
}

function parseBodyAsObject(data: any): any {
  if (data === null || data === undefined) return null;
  if (Buffer.isBuffer(data)) {
    try {
      return JSON.parse(data.toString('utf-8'));
    } catch {
      return null;
    }
  }
  if (data instanceof ArrayBuffer) {
    try {
      return JSON.parse(Buffer.from(data).toString('utf-8'));
    } catch {
      return null;
    }
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data === 'object') {
    return data;
  }
  return null;
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
  } else {
    const jobData = parseBodyAsObject(initialResponse.data);
    if (jobData && typeof jobData === 'object') {
      const candidate =
        jobData.status_url ||
        jobData.statusUrl ||
        jobData.job_url ||
        jobData.jobUrl ||
        jobData.location ||
        (jobData.job_id ? `/jobs/${jobData.job_id}` : undefined) ||
        (jobData.id && (jobData.status || jobData.state) ? `/jobs/${jobData.id}` : undefined);

      if (candidate && typeof candidate === 'string') {
        statusUrl = candidate.startsWith('http')
          ? candidate
          : `${baseUrl.replace(/\/$/, '')}/${candidate.replace(/^\//, '')}`;
      }
    }
  }

  if (!statusUrl) {
    // No valid status endpoint found, return initial 202 response
    return { response: initialResponse, timedOut: false };
  }

  // Cross-origin auth header stripping (Finding 19)
  const pollHeaders: Record<string, any> = { ...requestConfig.headers };
  if (!isSameOriginOrAllowed(statusUrl, baseUrl)) {
    stripSensitiveAuth(pollHeaders);
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
        responseType: requestConfig.responseType || 'arraybuffer',
      });

      if (statusRes.status === 200 || statusRes.status === 201) {
        const data = parseBodyAsObject(statusRes.data) || statusRes.data;
        if (data && typeof data === 'object') {
          const status = String(data.status || data.state || '').toLowerCase();
          const inProgressStatuses = [
            'pending',
            'in_progress',
            'in-progress',
            'inprogress',
            'running',
            'processing',
            'queued',
            'started',
            'active',
          ];

          if (inProgressStatuses.includes(status)) {
            // Still in progress, continue polling loop
          } else {
            // Completed, succeeded, failed, or payload without status field
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
