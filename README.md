# Plataforma GTM

MVP en Svelte para visualizar datos de instalaciones, obras, sensores, incidencias y documentos.

## Desarrollo Local

```bash
npm install
npm run dev
```

## Build de Produccion

```bash
npm run build
```

El resultado se genera en `dist/`.

## Despliegue en VPS con Docker Compose + Caddy

Caddy recibe el trafico publico, activa HTTPS automaticamente y reenvia la peticion al contenedor de la app.

Antes de arrancar, apunta el dominio al VPS con un registro `A` hacia la IP publica del servidor.

Prepara el archivo de entorno:

```bash
cp .env.example .env
nano .env
```

Cambia `APP_DOMAIN` por tu dominio real:

```bash
APP_DOMAIN=plataforma.tudominio.com
```

Arranca la plataforma:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Caddy solicitara y renovara el certificado SSL automaticamente cuando el dominio ya apunte al VPS.

## Actualizar en el Servidor

```bash
git pull
docker compose up -d --build
```

## Siguiente Paso Tecnico

Cuando entren datos reales y usuarios:

- Frontend Svelte para el panel.
- Backend/API separado para autenticacion, roles y datos.
- Base de datos PostgreSQL.
- Permisos: clientes ven solo sus instalaciones; usuarios GTM ven todas.
