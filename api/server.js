import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import pg from 'pg'

const { Pool } = pg

const app = express()
const port = Number(process.env.PORT ?? 3000)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const sessions = new Map()

app.use(cors())
app.use(express.json())

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':')
  const candidate = hashPassword(password, salt).split(':')[1]
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}

async function query(text, params) {
  const result = await pool.query(text, params)
  return result
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await query('select 1')
      return
    } catch (error) {
      if (attempt === 30) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

async function migrate() {
  await query('create extension if not exists pgcrypto')

  await query(`
    create table if not exists clients (
      id uuid primary key default gen_random_uuid(),
      key text unique not null,
      name text not null,
      created_at timestamptz not null default now()
    )
  `)

  await query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id),
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null check (role in ('gtm', 'client')),
      created_at timestamptz not null default now()
    )
  `)

  await query(`
    create table if not exists installations (
      id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients(id),
      slug text unique not null,
      name text not null,
      location text not null,
      status text not null,
      health integer not null,
      last_update text not null,
      phase text not null,
      manager text not null,
      type text not null,
      start_date text not null,
      metrics jsonb not null,
      sensors jsonb not null,
      incidents jsonb not null,
      documents jsonb not null,
      created_at timestamptz not null default now()
    )
  `)

  await query(`
    create table if not exists agent_tokens (
      id uuid primary key default gen_random_uuid(),
      installation_id uuid not null references installations(id),
      name text not null,
      token_hash text unique not null,
      created_at timestamptz not null default now()
    )
  `)

  await query(`
    create table if not exists measurements (
      id bigserial primary key,
      installation_id uuid not null references installations(id),
      source text not null default 'agent',
      timestamp timestamptz not null,
      values jsonb not null,
      created_at timestamptz not null default now()
    )
  `)

  await query(
    'create index if not exists measurements_installation_timestamp_idx on measurements (installation_id, timestamp desc)'
  )
}

async function upsertClient(key, name) {
  const result = await query(
    `insert into clients (key, name)
     values ($1, $2)
     on conflict (key) do update set name = excluded.name
     returning id`,
    [key, name]
  )
  return result.rows[0].id
}

async function upsertUser({ clientId, name, email, password, role }) {
  await query(
    `insert into users (client_id, name, email, password_hash, role)
     values ($1, $2, lower($3), $4, $5)
     on conflict (email) do update set
       client_id = excluded.client_id,
       name = excluded.name,
       role = excluded.role`,
    [clientId, name, email, hashPassword(password), role]
  )
}

async function upsertInstallation(clientId) {
  const result = await query(
    `insert into installations (
      client_id, slug, name, location, status, health, last_update, phase,
      manager, type, start_date, metrics, sensors, incidents, documents
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    on conflict (slug) do update set
      client_id = excluded.client_id,
      name = excluded.name,
      location = excluded.location,
      status = excluded.status,
      health = excluded.health,
      last_update = excluded.last_update,
      phase = excluded.phase,
      manager = excluded.manager,
      type = excluded.type,
      start_date = excluded.start_date,
      metrics = excluded.metrics,
      sensors = excluded.sensors,
      incidents = excluded.incidents,
      documents = excluded.documents
    returning id`,
    [
      clientId,
      'productos-lozano-central',
      'Productos Lozano Central',
      'Valencia',
      'Operativa',
      94,
      'Hoy, 11:05',
      'Seguimiento',
      'Equipo GTM',
      'Monitorizacion energetica y agente local',
      '03 Ago 2026',
      JSON.stringify([
        { label: 'Consumo actual', value: '31.7 kW', trend: '-2% vs semana pasada' },
        { label: 'Disponibilidad', value: '99.1%', trend: 'Dentro de SLA' },
        { label: 'Alertas abiertas', value: '0', trend: 'Sin incidencias' },
        { label: 'Equipos monitorizados', value: '14', trend: '100% conectados' }
      ]),
      JSON.stringify([
        { label: 'Raspberry agente', value: 'Online', state: 'Normal' },
        { label: 'Contador general', value: '31.7 kW', state: 'Normal' },
        { label: 'Cuadro principal', value: '406 V', state: 'Normal' }
      ]),
      JSON.stringify([
        'Cliente creado en base de datos PostgreSQL.',
        'Pendiente conectar la Raspberry de Productos Lozano para datos reales.'
      ]),
      JSON.stringify(['Ficha cliente Productos Lozano.pdf', 'Esquema conexion agente.pdf'])
    ]
  )

  return result.rows[0].id
}

function hashAgentToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function upsertAgentToken({ installationId, name, token }) {
  await query(
    `insert into agent_tokens (installation_id, name, token_hash)
     values ($1, $2, $3)
     on conflict (token_hash) do update set
       installation_id = excluded.installation_id,
       name = excluded.name`,
    [installationId, name, hashAgentToken(token)]
  )
}

async function seed() {
  const gtmClientId = await upsertClient('gtm', 'GTM')
  const lozanoClientId = await upsertClient('productos-lozano', 'Productos Lozano')

  await upsertUser({
    clientId: gtmClientId,
    name: 'Equipo GTM',
    email: process.env.GTM_ADMIN_EMAIL ?? 'gtm@gtm.es',
    password: process.env.GTM_ADMIN_PASSWORD ?? 'gtm2026',
    role: 'gtm'
  })

  await upsertUser({
    clientId: lozanoClientId,
    name: 'Productos Lozano',
    email: process.env.LOZANO_USER_EMAIL ?? 'cliente@productoslozano.es',
    password: process.env.LOZANO_USER_PASSWORD ?? 'lozano2026',
    role: 'client'
  })

  const installationId = await upsertInstallation(lozanoClientId)

  await upsertAgentToken({
    installationId,
    name: 'Raspberry Productos Lozano',
    token: process.env.LOZANO_AGENT_TOKEN ?? 'lozano-agent-token-dev'
  })
}

function serializeInstallation(row) {
  const liveSensors = row.latest_values
    ? Object.entries(row.latest_values).map(([label, value]) => ({
        label,
        value: formatMeasurementValue(value),
        state: 'Normal'
      }))
    : row.sensors

  return {
    id: row.slug,
    name: row.name,
    client: row.client_name,
    location: row.location,
    status: row.status,
    health: row.health,
    lastUpdate: row.latest_timestamp ? new Date(row.latest_timestamp).toLocaleString('es-ES') : row.last_update,
    phase: row.phase,
    manager: row.manager,
    type: row.type,
    startDate: row.start_date,
    metrics: row.metrics,
    sensors: liveSensors,
    incidents: row.incidents,
    documents: row.documents
  }
}

function formatMeasurementValue(value) {
  if (typeof value === 'boolean') return value ? 'Activo' : 'Parado'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
  return String(value)
}

function countReactorFills(samples) {
  let armed = false
  let count = 0

  for (const sample of samples) {
    const value = sample.values?.nivel_reactor

    if (!Number.isFinite(value)) continue


    if (value < 25) armed = true

    if (armed && value > 70) {
      count += 1
      armed = false
    }
  }

  return count
}

function getSession(req) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  return token ? sessions.get(token) : null
}

function requireAuth(req, res, next) {
  const session = getSession(req)
  if (!session) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }
  req.user = session
  next()
}

async function requireAgent(req, res, next) {
  try {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-agent-token']

    if (!token) {
      res.status(401).json({ error: 'Token de agente requerido' })
      return
    }

    const result = await query(
      `select agent_tokens.installation_id, installations.slug
       from agent_tokens
       join installations on installations.id = agent_tokens.installation_id
       where agent_tokens.token_hash = $1`,
      [hashAgentToken(String(token))]
    )

    const agent = result.rows[0]
    if (!agent) {
      res.status(401).json({ error: 'Token de agente invalido' })
      return
    }

    req.agent = agent
    next()
  } catch (error) {
    next(error)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/agent/measurements', requireAgent, async (req, res, next) => {
  try {
    const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date()
    const values = req.body.values

    if (Number.isNaN(timestamp.getTime()) || !values || typeof values !== 'object' || Array.isArray(values)) {
      res.status(400).json({ error: 'Muestra invalida' })
      return
    }

    await query(
      `insert into measurements (installation_id, source, timestamp, values)
       values ($1, $2, $3, $4)`,
      [req.agent.installation_id, 'raspberry', timestamp.toISOString(), JSON.stringify(values)]
    )

    await query('update installations set last_update = $1 where id = $2', [
      timestamp.toISOString(),
      req.agent.installation_id
    ])

    res.status(201).json({ ok: true, installation: req.agent.slug })
  } catch (error) {
    next(error)
  }
})

app.post('/api/login', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase()
    const password = String(req.body.password ?? '')

    const result = await query(
      `select users.id, users.client_id, users.name, users.email, users.password_hash, users.role, clients.name as client_name
       from users
       left join clients on clients.id = users.client_id
       where users.email = $1`,
      [email]
    )

    const user = result.rows[0]
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Email o contrasena incorrectos.' })
      return
    }

    const token = crypto.randomBytes(32).toString('hex')
    const session = {
      id: user.id,
      clientId: user.client_id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientName: user.client_name
    }

    sessions.set(token, session)
    res.json({ token, user: session })
  } catch (error) {
    next(error)
  }
})

app.get('/api/installations', requireAuth, async (req, res, next) => {
  try {
    const params = []
    let where = ''

    if (req.user.role !== 'gtm') {
      params.push(req.user.clientId)
      where = 'where installations.client_id = $1'
    }

    const result = await query(
      `select installations.*, clients.name as client_name,
         latest.values as latest_values,
         latest.timestamp as latest_timestamp
       from installations
       join clients on clients.id = installations.client_id
       left join lateral (
         select measurements.values, measurements.timestamp
         from measurements
         where measurements.installation_id = installations.id
         order by measurements.timestamp desc
         limit 1
       ) latest on true
       ${where}
       order by installations.created_at asc`,
      params
    )

    res.json({ installations: result.rows.map(serializeInstallation) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/installations/:slug/measurements', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 240), 1), 2000)
    const params = [req.params.slug]
    let accessWhere = ''

    if (req.user.role !== 'gtm') {
      params.push(req.user.clientId)
      accessWhere = 'and installations.client_id = $2'
    }

    const installationResult = await query(
      `select installations.id, installations.slug
       from installations
       where installations.slug = $1 ${accessWhere}`,
      params
    )

    const installation = installationResult.rows[0]
    if (!installation) {
      res.status(404).json({ error: 'Instalacion no encontrada' })
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [samplesResult, todayResult] = await Promise.all([
      query(
        `select timestamp, values
         from measurements
         where installation_id = $1
         order by timestamp desc
         limit $2`,
        [installation.id, limit]
      ),
      query(
        `select timestamp, values
         from measurements
         where installation_id = $1 and timestamp >= $2
         order by timestamp asc`,
        [installation.id, today.toISOString()]
      )
    ])

    const samples = samplesResult.rows
      .reverse()
      .map((row) => ({ timestamp: row.timestamp.toISOString(), values: row.values }))
    const todaySamples = todayResult.rows.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      values: row.values
    }))

    res.json({
      samples,
      stats: {
        date: today.toISOString().slice(0, 10),
        reactorFills: countReactorFills(todaySamples)
      }
    })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Error interno del servidor' })
})

await waitForDatabase()
await migrate()
await seed()

app.listen(port, () => {
  console.log(`GTM API listening on ${port}`)
})
