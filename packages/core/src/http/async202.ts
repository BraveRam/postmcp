import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { sleepWithJitter } from './retry.js';

export async function pollAsyncJob(
  initialResponse: AxiosResponse,
  baseUrl: string,
  requestConfig: AxiosRequestConfig,
  maxTimeoutMs: number = 15000
): Promise<AxiosResponse> {
  const locationHeader = initialResponse.headers['location'] || initialResponse.headers['status-uri'];
  let statusUrl: string | null = null;

  if (locationHeader) {
    statusUrl = locationHeader.startsWith('http') ? locationHeader : `${baseUrl.replace(/\/$/, '')}/${locationHeader.replace(/^\//, '')}`;
  } else if (initialResponse.data && typeof initialResponse.data === 'object') {
    const jobData = initialResponse.data;
    if (jobData.status_url) {
      statusUrl = jobData.status_url;
    } else if (jobData.id || jobData.job_id) {
      const id = jobData.id || jobData.job_id;
      statusUrl = `${baseUrl.replace(/\/$/, '')}/jobs/${id}`;
    }
  }

  if (!statusUrl) {
    // No status URL found, return initial 202 response
    return initialResponse;
  }

  const startTime = Date.now();
  let delay = 500;

  while (Date.now() - startTime < maxTimeoutMs) {
    await sleepWithJitter(delay);

    try {
      const statusRes = await axios.get(statusUrl, {
        headers: requestConfig.headers,
        timeout: 5000,
      });

      if (statusRes.status === 200 || statusRes.status === 201) {
        const data = statusRes.data;
        // Check if finished or still pending
        if (data && typeof data === 'object') {
          const status = (data.status || data.state || '').toLowerCase();
          if (status === 'completed' || status === 'succeeded' || status === 'finished' || status === 'success') {
            return statusRes;
          }
          if (status === 'failed' || status === 'error') {
            return statusRes;
          }
        } else {
          return statusRes;
        }
      }

      delay = Math.min(delay * 1.5, 3000);
    } catch {
      break;
    }
  }

  return initialResponse;
}
