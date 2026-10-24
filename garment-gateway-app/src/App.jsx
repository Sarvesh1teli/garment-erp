import { useEffect, useRef, useState } from 'react'
import { LogOut, MessageSquare, Pause, Play, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { gatewayApi, gatewayApiUrl } from './api'
import { isNativeGateway, sendSms, startSmsQueue, stopSmsQueue } from './sms'

const DEFAULT_APP_CODE = 'GARMENTERP'
const DEFAULT_SEND_DELAY_SECONDS = 5
const DEFAULT_BATCH_LIMIT = 300
const DEFAULT_PAUSE_AFTER = 50
const DEFAULT_PAUSE_SECONDS = 120
const INSTALLATION_ID_KEY = 'gateway_installation_id'

function gatewayInstallationId() {
  let value = localStorage.getItem(INSTALLATION_ID_KEY)
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `android-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(INSTALLATION_ID_KEY, value)
  }
  return value
}

function normalizeJob(job) {
  return {
    id: job.id,
    recipientName: job.recipientName || job.recipient_name || '',
    recipientPhone: job.recipientPhone || job.recipient_phone || '',
    message: job.message || '',
    referenceType: job.referenceType || job.reference_type || '',
    referenceId: job.referenceId || job.reference_id || '',
    attempts: job.attempts || 0,
  }
}

export default function App() {
  const [form, setForm] = useState({
    loginMode: 'device',
    schoolCode: localStorage.getItem('gateway_school_code') || '',
    appCode: localStorage.getItem('gateway_app_code') || DEFAULT_APP_CODE,
    deviceKey: '',
    mobileNumber: '',
    pin: '',
  })
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [running, setRunning] = useState(() => localStorage.getItem('gateway_running') === 'true')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({
    delaySeconds: Number(localStorage.getItem('gateway_delay_seconds') || DEFAULT_SEND_DELAY_SECONDS),
    batchLimit: Number(localStorage.getItem('gateway_batch_limit') || DEFAULT_BATCH_LIMIT),
    pauseAfter: Number(localStorage.getItem('gateway_pause_after') || DEFAULT_PAUSE_AFTER),
    pauseSeconds: Number(localStorage.getItem('gateway_pause_seconds') || DEFAULT_PAUSE_SECONDS),
  })
  const stoppedRef = useRef(false)

  const signedIn = Boolean(localStorage.getItem('gateway_token'))

  useEffect(() => {
    if (signedIn) {
      refresh()
      if (running && isNativeGateway()) {
        startSmsQueue({
          token: localStorage.getItem('gateway_token'),
          apiUrl: gatewayApiUrl,
          ...settings,
        }).catch(err => setError(err.message || 'Could not resume automatic SMS delivery'))
      }
    }
  }, [])

  useEffect(() => {
    stoppedRef.current = !running
    if (running && !isNativeGateway()) setRunning(false)
  }, [running, jobs])

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(refresh, 10000)
    return () => window.clearInterval(timer)
  }, [running])

  async function login(e) {
    e.preventDefault()
    setError('')
    try {
      const data = await gatewayApi.login({ ...form, installationId: gatewayInstallationId() })
      localStorage.setItem('gateway_token', data.token)
      localStorage.setItem('gateway_school_code', data.schoolCode)
      localStorage.setItem('gateway_app_code', data.appCode)
      localStorage.setItem('gateway_login_mode', form.loginMode)
      setProfile(data)
      setStatus('Gateway connected')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  function logout() {
    stopSmsQueue().catch(() => {})
    localStorage.removeItem('gateway_token')
    localStorage.removeItem('gateway_running')
    setProfile(null)
    setJobs([])
    setRunning(false)
    setStatus('')
  }

  async function toggleQueue() {
    setError('')
    const next = !running
    if (next && !isNativeGateway()) { setError('SMS sending requires the Android Billing Gateway app'); return }
    try {
      if (next && isNativeGateway()) {
        await startSmsQueue({
          token: localStorage.getItem('gateway_token'),
          apiUrl: gatewayApiUrl,
          ...settings,
        })
      } else if (!next && isNativeGateway()) {
        await stopSmsQueue()
      }
      localStorage.setItem('gateway_running', String(next))
      setRunning(next)
      setStatus(next ? 'Automatic SMS delivery is active' : 'SMS delivery is paused')
    } catch (err) {
      setError(err.message || 'Could not change SMS queue status')
    }
  }

  async function refresh() {
    setError('')
    try {
      const [nextProfile, nextJobs] = await Promise.all([
        gatewayApi.profile(),
        // Viewing the queue must not claim jobs that the native SMS service
        // has not yet asked to send.
        gatewayApi.previewJobs(25),
      ])
      setProfile(nextProfile)
      setJobs((nextJobs || []).map(normalizeJob))
    } catch (err) {
      setError(err.message)
    }
  }

  async function processQueue() {
    if (sending) return
    setSending(true)
    try {
      let sentInBatch = 0
      let currentJobs = jobs.length ? jobs : (await gatewayApi.jobs(Math.min(settings.batchLimit, 100))).map(normalizeJob)
      setJobs(currentJobs)
      while (!stoppedRef.current) {
        if (sentInBatch >= settings.batchLimit) {
          setStatus(`Batch limit ${settings.batchLimit} reached. Paused automatically.`)
          setRunning(false)
          break
        }
        if (!currentJobs.length) {
          setStatus('No pending SMS. Checking again...')
          await sleep(10000)
          currentJobs = (await gatewayApi.jobs(Math.min(settings.batchLimit, 100))).map(normalizeJob)
          setJobs(currentJobs)
          continue
        }
        const job = currentJobs[0]
        setStatus(`Sending SMS to ${job.recipientPhone}`)
        try {
          await sendSms(job.recipientPhone, job.message)
          await gatewayApi.status(job.id, { status: 'SENT' })
          setStatus(`Sent to ${job.recipientPhone}`)
          sentInBatch += 1
        } catch (err) {
          await gatewayApi.status(job.id, { status: 'FAILED', errorMessage: err.message }).catch(() => {})
          setError(`Failed ${job.recipientPhone}: ${err.message}`)
        }
        currentJobs = currentJobs.slice(1)
        setJobs(currentJobs)
        if (!stoppedRef.current && settings.pauseAfter > 0 && sentInBatch > 0 && sentInBatch % settings.pauseAfter === 0) {
          setStatus(`Pause after ${settings.pauseAfter} SMS. Waiting ${settings.pauseSeconds} seconds...`)
          await sleep(settings.pauseSeconds * 1000)
        }
        if (!stoppedRef.current) await sleep(settings.delaySeconds * 1000)
      }
    } finally {
      setSending(false)
    }
  }

  function updateSetting(key, value) {
    const number = Math.max(0, Number(value || 0))
    const next = { ...settings, [key]: number }
    setSettings(next)
    localStorage.setItem(`gateway_${settingStorageKey(key)}`, String(number))
    if (running && isNativeGateway()) {
      startSmsQueue({
        token: localStorage.getItem('gateway_token'),
        apiUrl: gatewayApiUrl,
        ...next,
      }).catch(err => setError(err.message || 'Could not update queue settings'))
    }
  }

  if (!signedIn) {
    return (
      <main className="login-shell">
        <section className="brand-panel">
          <div className="brand-mark">TG</div>
          <div>
            <h1>Teli Garment Gateway</h1>
            <p>SIM SMS delivery for desktop and cloud apps.</p>
          </div>
        </section>
        <form className="login-card" onSubmit={login}>
          <div className="eyebrow"><ShieldCheck size={18} /> Secure gateway access</div>
          <h2>Connect billing phone</h2>
          {error && <div className="error">{error}</div>}
          <label>Garment SMS server (HTTPS)</label>
          <input type="url" defaultValue={gatewayApiUrl} placeholder="https://billing-sms.yourdomain.com" onBlur={e => {
            const url = e.target.value.trim().replace(/\/$/, '')
            if (url && url !== gatewayApiUrl && url.startsWith('https://')) {
              localStorage.setItem('garment_gateway_api_url', url)
              localStorage.removeItem('gateway_token')
              window.location.reload()
            }
          }} required />
          <label>Shop code</label>
          <input value={form.schoolCode} onChange={e => setForm({ ...form, schoolCode: e.target.value })} placeholder="Example: SHOP001" required />
          <label>App code</label>
          <input value={form.appCode} onChange={e => setForm({ ...form, appCode: e.target.value })} placeholder="GARMENTERP" required />
          {false ? (
            <>
              <label>Mobile number</label>
              <input value={form.mobileNumber} onChange={e => setForm({ ...form, mobileNumber: e.target.value })} placeholder="10 digit mobile number" inputMode="tel" maxLength={10} required />
              <label>PIN</label>
              <input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="Teacher or driver PIN" type="password" inputMode="numeric" required />
            </>
          ) : (
            <>
              <label>6-character pairing code</label>
              <input value={form.deviceKey} onChange={e => setForm({ ...form, deviceKey: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 160) })} placeholder="Example: K7M2QP" autoCapitalize="characters" required />
            </>
          )}
          <button type="submit"><Send size={18} /> Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark small">TG</div>
        <div>
          <h1>Teli Garment Gateway</h1>
          <p>{profile?.schoolCode || form.schoolCode} · {profile?.appCode || form.appCode}</p>
        </div>
        <button className="icon-button" onClick={logout}><LogOut size={24} /></button>
      </header>
      <section className="summary">
        <div><span>Pending</span><strong>{profile?.pending ?? jobs.length}</strong></div>
        <div><span>Submitted today</span><strong>{profile?.sentToday ?? 0}</strong></div>
        <div><span>Failed</span><strong>{profile?.failed ?? 0}</strong></div>
      </section>
      {error && <div className="error">{error}</div>}
      {status && <div className="success">{status}</div>}
      <section className="control-card">
        <div className="control-head">
          <div>
            <div className="eyebrow"><MessageSquare size={18} /> SIM SMS queue</div>
            <h2>{running ? 'Sending is active' : 'Sending is paused'}</h2>
            <p>Messages are submitted through this phone SIM. Submitted does not mean delivery confirmed.</p>
          </div>
          <button className={running ? 'danger' : 'primary'} onClick={toggleQueue}>
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? 'Pause' : 'Start'}
          </button>
        </div>
        <div className="settings-grid">
          <label>
            SMS delay
            <select value={settings.delaySeconds} onChange={e => updateSetting('delaySeconds', e.target.value)}>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
            </select>
          </label>
          <label>
            Batch limit
            <select value={settings.batchLimit} onChange={e => updateSetting('batchLimit', e.target.value)}>
              <option value={50}>50 SMS</option>
              <option value={100}>100 SMS</option>
              <option value={200}>200 SMS</option>
              <option value={300}>300 SMS</option>
            </select>
          </label>
          <label>
            Pause after
            <select value={settings.pauseAfter} onChange={e => updateSetting('pauseAfter', e.target.value)}>
              <option value={0}>No pause</option>
              <option value={25}>25 SMS</option>
              <option value={50}>50 SMS</option>
              <option value={100}>100 SMS</option>
            </select>
          </label>
          <label>
            Pause duration
            <select value={settings.pauseSeconds} onChange={e => updateSetting('pauseSeconds', e.target.value)}>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </label>
        </div>
        <button className="secondary" onClick={refresh}><RefreshCw size={18} /> Refresh queue</button>
      </section>
      <section className="queue-card">
        <h2>Pending SMS</h2>
        {!jobs.length ? <div className="empty">No pending SMS jobs</div> : jobs.map(job => (
          <article className="job" key={job.id}>
            <div>
              <strong>{job.recipientName || job.recipientPhone}</strong>
              <span>{job.recipientPhone}</span>
            </div>
            <p>{job.message}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function settingStorageKey(key) {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}
