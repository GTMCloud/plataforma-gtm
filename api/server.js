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
  await query(
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
      documents = excluded.documents`,
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

  await upsertInstallation(lozanoClientId)
}

function serializeInstallation(row) {
  return {
    id: row.slug,
    name: row.name,
    client: row.client_name,
    location: row.location,
    status: row.status,
    health: row.health,
    lastUpdate: row.last_update,
    phase: row.phase,
    manager: row.manager,
    type: row.type,
    startDate: row.start_date,
    metrics: row.metrics,
    sensors: row.sensors,
    incidents: row.incidents,
    documents: row.documents
  }
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
      `select installations.*, clients.name as client_name
       from installations
       join clients on clients.id = installations.client_id
       ${where}
       order by installations.created_at asc`,
      params
    )

    res.json({ installations: result.rows.map(serializeInstallation) })
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
