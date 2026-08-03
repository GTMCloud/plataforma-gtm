# Plataforma GTM

Plataforma en Svelte con API Node y PostgreSQL para visualizar datos de instalaciones, obras, sensores, incidencias y documentos por cliente.

## Desarrollo Local

Frontend:

```bash
npm install
npm run dev
```

API:

```bash
cd api
npm install
npm start
```

Para desarrollo completo se recomienda usar Docker Compose, porque levanta frontend, API, PostgreSQL y Caddy juntos.

## Build de Produccion

```bash
npm run build
```

El resultado se genera en `dist/`.

## Despliegue en VPS con Docker Compose + Caddy

Caddy recibe el trafico publico, activa HTTPS automaticamente cuando hay dominio, sirve el frontend y reenvia `/api` al backend.

Antes de arrancar, apunta el dominio al VPS con un registro `A` hacia la IP publica del servidor.

Prepara el archivo de entorno:

```bash
cp .env.example .env
nano .env
```

Cambia `APP_DOMAIN` por tu dominio real o usa `:80` para acceder solo por IP sin HTTPS:

```bash
APP_DOMAIN=plataforma.tudominio.com
```

Configura contrasenas reales en `.env`:

```bash
POSTGRES_PASSWORD=una-contrasena-larga
GTM_ADMIN_PASSWORD=otra-contrasena-larga
LOZANO_USER_PASSWORD=otra-contrasena-larga
LOZANO_AGENT_TOKEN=token-largo-para-la-raspberry
```

Arranca la plataforma:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Caddy solicitara y renovara el certificado SSL automaticamente cuando `APP_DOMAIN` sea un dominio real y ya apunte al VPS.

## Accesos Iniciales

Se crean en PostgreSQL al arrancar la API:

- Usuario GTM: `GTM_ADMIN_EMAIL` / `GTM_ADMIN_PASSWORD`.
- Cliente Productos Lozano: `LOZANO_USER_EMAIL` / `LOZANO_USER_PASSWORD`.

## Actualizar en el Servidor

```bash
git pull
docker compose up -d --build
```

## Arquitectura

- `app`: frontend Svelte servido por Nginx.
- `api`: backend Node/Express para login, permisos e instalaciones.
- `db`: PostgreSQL con clientes, usuarios e instalaciones.
- `caddy`: proxy publico y HTTPS automatico con dominio.

## Ingesta de Agentes

Las Raspberry envian muestras a:

```text
POST /api/agent/measurements
Authorization: Bearer <LOZANO_AGENT_TOKEN>
```

Payload esperado:

```json
{
  "timestamp": "2026-08-03T11:10:00Z",
  "values": {
    "nivel_reactor": 81.094,
    "bomba_lechada": false
  }
}
```
