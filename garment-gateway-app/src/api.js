import { Capacitor, CapacitorHttp } from '@capacitor/core'

const API_URL = (localStorage.getItem('garment_gateway_api_url') || import.meta.env.VITE_GATEWAY_API_URL || 'https://grm-bill-sms.telisoftware.com').replace(/\/$/, '')
export const gatewayApiUrl = API_URL

async function request(path, options = {}) {
  if (!API_URL.startsWith('https://')) throw new Error('Set the separate Garment SMS HTTPS server URL first')
  const token = localStorage.getItem('gateway_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: `${API_URL}${path}`,
      method: options.method || 'GET',
      headers,
      data: options.body ? JSON.parse(options.body) : undefined,
    })
    const data = typeof response.data === 'string' ? JSON.parse(response.data || '{}') : (response.data || {})
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(data.message || data.error || `Request failed (${response.status})`)
      error.status = response.status
      throw error
    }
    return data
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export const gatewayApi = {
  login: body => request('/api/v1/gateway/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  profile: () => request('/api/v1/gateway/me'),
  jobs: limit => request(`/api/v1/gateway/jobs?limit=${limit || 25}`),
  previewJobs: limit => request(`/api/v1/gateway/jobs/preview?limit=${limit || 25}`),
  status: (jobId, body) => request(`/api/v1/gateway/jobs/${jobId}/status`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  heartbeat: () => request('/api/v1/gateway/heartbeat', { method: 'POST' }),
}
