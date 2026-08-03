<script>
  const users = [
    {
      id: 'user-gtm',
      name: 'Equipo GTM',
      email: 'gtm@gtm.es',
      password: 'gtm2026',
      role: 'gtm',
      clientKey: null
    },
    {
      id: 'user-alboran',
      name: 'Promotora Alboran',
      email: 'cliente@alboran.es',
      password: 'cliente2026',
      role: 'client',
      clientKey: 'alboran'
    },
    {
      id: 'user-costa',
      name: 'Grupo Costa Viva',
      email: 'cliente@costaviva.es',
      password: 'cliente2026',
      role: 'client',
      clientKey: 'costa-viva'
    }
  ]

  const installations = [
    {
      id: 'obra-norte',
      clientKey: 'alboran',
      name: 'Residencial Norte',
      client: 'Promotora Alboran',
      location: 'Valencia',
      status: 'Operativa',
      health: 96,
      lastUpdate: 'Hoy, 09:42',
      phase: 'Mantenimiento',
      manager: 'Laura Mena',
      type: 'Control energetico y telemetria',
      startDate: '12 Feb 2026',
      metrics: [
        { label: 'Consumo actual', value: '42.8 kW', trend: '-8% vs semana pasada' },
        { label: 'Disponibilidad', value: '99.4%', trend: 'Dentro de SLA' },
        { label: 'Alertas abiertas', value: '2', trend: '1 critica' },
        { label: 'Equipos monitorizados', value: '38', trend: '100% conectados' }
      ],
      sensors: [
        { label: 'Sala tecnica', value: '23.6 C', state: 'Normal' },
        { label: 'Cuadro principal', value: '412 V', state: 'Normal' },
        { label: 'Bomba circulacion', value: '1.8 bar', state: 'Revision' }
      ],
      incidents: [
        'Pico de consumo detectado en franja 07:00-08:00.',
        'Revision preventiva programada para el viernes.'
      ],
      documents: ['Acta de puesta en marcha.pdf', 'Plano unifilar.dwg', 'Informe mensual julio.pdf']
    },
    {
      id: 'hotel-mar',
      clientKey: 'costa-viva',
      name: 'Hotel Mar Azul',
      client: 'Grupo Costa Viva',
      location: 'Alicante',
      status: 'En revision',
      health: 82,
      lastUpdate: 'Ayer, 18:10',
      phase: 'Optimizacion',
      manager: 'David Soler',
      type: 'Climatizacion y consumos',
      startDate: '03 Abr 2026',
      metrics: [
        { label: 'Consumo actual', value: '118.2 kW', trend: '+4% vs semana pasada' },
        { label: 'Disponibilidad', value: '97.1%', trend: 'SLA en observacion' },
        { label: 'Alertas abiertas', value: '5', trend: '2 criticas' },
        { label: 'Equipos monitorizados', value: '64', trend: '3 sin senal' }
      ],
      sensors: [
        { label: 'Roof top A', value: '31.2 C', state: 'Alerta' },
        { label: 'ACS acumulador', value: '58.4 C', state: 'Normal' },
        { label: 'Planta 4', value: '27.9 C', state: 'Revision' }
      ],
      incidents: [
        'Tres unidades de climatizacion sin comunicacion estable.',
        'Consumo nocturno superior al patron previsto.'
      ],
      documents: ['Checklist climatizacion.pdf', 'Lecturas BMS.xlsx', 'Contrato mantenimiento.pdf']
    },
    {
      id: 'logistica-sur',
      clientKey: 'nexo',
      name: 'Plataforma Logistica Sur',
      client: 'Nexo Distribucion',
      location: 'Murcia',
      status: 'Instalacion',
      health: 68,
      lastUpdate: 'Lun, 13:25',
      phase: 'Despliegue',
      manager: 'Marta Ribes',
      type: 'Fotovoltaica y cuadros',
      startDate: '24 Jun 2026',
      metrics: [
        { label: 'Potencia FV', value: '186 kWp', trend: '72% instalado' },
        { label: 'Disponibilidad', value: '91.8%', trend: 'Pendiente comisionado' },
        { label: 'Alertas abiertas', value: '7', trend: 'Instalacion activa' },
        { label: 'Equipos monitorizados', value: '21', trend: '14 pendientes' }
      ],
      sensors: [
        { label: 'Inversor 01', value: '46.5 kW', state: 'Normal' },
        { label: 'String 07', value: '0 A', state: 'Alerta' },
        { label: 'Cuadro nave B', value: '398 V', state: 'Normal' }
      ],
      incidents: [
        'String 07 pendiente de conexion final.',
        'Falta validar lectura de contador fiscal.'
      ],
      documents: ['Planning instalacion.pdf', 'Certificados paneles.zip', 'Esquema comunicaciones.pdf']
    }
  ]

  let currentUser = null
  let email = 'gtm@gtm.es'
  let password = 'gtm2026'
  let loginError = ''
  let selectedId = installations[0].id

  $: accessibleInstallations = currentUser?.role === 'gtm'
    ? installations
    : installations.filter((installation) => installation.clientKey === currentUser?.clientKey)
  $: if (
    currentUser &&
    accessibleInstallations.length > 0 &&
    !accessibleInstallations.some((installation) => installation.id === selectedId)
  ) {
    selectedId = accessibleInstallations[0].id
  }
  $: selectedInstallation = accessibleInstallations.find((installation) => installation.id === selectedId)
    ?? accessibleInstallations[0]
  $: totalAlerts = accessibleInstallations.reduce(
    (total, installation) => total + Number(installation.metrics[2].value),
    0
  )
  $: averageHealth = accessibleInstallations.length
    ? Math.round(
        accessibleInstallations.reduce((total, installation) => total + installation.health, 0) /
          accessibleInstallations.length
      )
    : 0

  function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase()
    const user = users.find(
      (candidate) => candidate.email === normalizedEmail && candidate.password === password
    )

    if (!user) {
      loginError = 'Email o contrasena incorrectos.'
      return
    }

    currentUser = user
    loginError = ''
  }

  function handleLogout() {
    currentUser = null
    password = ''
    loginError = ''
    selectedId = installations[0].id
  }
</script>

{#if !currentUser}
  <main class="login-shell">
    <section class="login-panel">
      <div class="login-copy">
        <span class="brand-mark">GTM</span>
        <span class="eyebrow">Acceso privado</span>
        <h1>Plataforma de instalaciones GTM</h1>
        <p>
          Accede al panel para consultar obras, sensores, incidencias y documentos segun tu perfil.
        </p>
      </div>

      <form class="login-card" on:submit|preventDefault={handleLogin}>
        <div>
          <span class="eyebrow">Login</span>
          <h2>Entrar al panel</h2>
        </div>

        <label>
          Email
          <input bind:value={email} type="email" autocomplete="email" required />
        </label>

        <label>
          Contrasena
          <input bind:value={password} type="password" autocomplete="current-password" required />
        </label>

        {#if loginError}
          <p class="login-error">{loginError}</p>
        {/if}

        <button type="submit">Entrar</button>

        <div class="demo-users">
          <strong>Usuarios demo</strong>
          <span>GTM: gtm@gtm.es / gtm2026</span>
          <span>Cliente: cliente@alboran.es / cliente2026</span>
        </div>
      </form>
    </section>
  </main>
{:else}
<main class="shell">
  <aside class="sidebar" aria-label="Instalaciones">
    <div class="brand">
      <span class="brand-mark">GTM</span>
      <div>
        <p>Plataforma</p>
        <strong>Instalaciones</strong>
      </div>
    </div>

    <div class="sidebar-summary">
      <span>{accessibleInstallations.length} obras visibles</span>
      <strong>{averageHealth}% salud media</strong>
    </div>

    <div class="user-card">
      <span>{currentUser.role === 'gtm' ? 'Usuario GTM' : 'Cliente'}</span>
      <strong>{currentUser.name}</strong>
      <button type="button" on:click={handleLogout}>Cerrar sesion</button>
    </div>

    <nav class="installation-list">
      {#each accessibleInstallations as installation}
        <button
          class:active={installation.id === selectedId}
          type="button"
          on:click={() => (selectedId = installation.id)}
        >
          <span>{installation.name}</span>
          <small>{installation.client}</small>
        </button>
      {/each}
    </nav>
  </aside>

  <section class="content">
    <header class="hero-card">
      <div>
        <span class="eyebrow">Vista de datos por instalacion</span>
        <h1>{selectedInstallation.name}</h1>
        <p>
          Seguimiento centralizado de estado, consumos, sensores, incidencias y documentacion
          tecnica para cliente y equipo GTM.
        </p>
      </div>
      <div class="status-card">
        <span class="status {selectedInstallation.status === 'Operativa' ? 'ok' : 'warn'}">
          {selectedInstallation.status}
        </span>
        <strong>{selectedInstallation.health}%</strong>
        <small>Salud de instalacion</small>
      </div>
    </header>

    <section class="overview-grid" aria-label="Resumen global">
      <article>
        <span>Cliente</span>
        <strong>{selectedInstallation.client}</strong>
      </article>
      <article>
        <span>Ubicacion</span>
        <strong>{selectedInstallation.location}</strong>
      </article>
      <article>
        <span>Responsable GTM</span>
        <strong>{selectedInstallation.manager}</strong>
      </article>
      <article>
        <span>Ultima actualizacion</span>
        <strong>{selectedInstallation.lastUpdate}</strong>
      </article>
    </section>

    <section class="metrics-grid" aria-label="Indicadores principales">
      {#each selectedInstallation.metrics as metric}
        <article class="metric-card">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.trend}</small>
        </article>
      {/each}
    </section>

    <div class="detail-grid">
      <section class="panel technical-card">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Ficha tecnica</span>
            <h2>Datos de obra</h2>
          </div>
          <span class="phase">{selectedInstallation.phase}</span>
        </div>

        <dl>
          <div>
            <dt>Tipo de instalacion</dt>
            <dd>{selectedInstallation.type}</dd>
          </div>
          <div>
            <dt>Fecha de inicio</dt>
            <dd>{selectedInstallation.startDate}</dd>
          </div>
          <div>
            <dt>Alertas totales plataforma</dt>
            <dd>{totalAlerts}</dd>
          </div>
        </dl>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Telemetria</span>
            <h2>Sensores clave</h2>
          </div>
        </div>

        <div class="sensor-list">
          {#each selectedInstallation.sensors as sensor}
            <article>
              <div>
                <strong>{sensor.label}</strong>
                <span>{sensor.value}</span>
              </div>
              <small class:alert={sensor.state === 'Alerta'}>{sensor.state}</small>
            </article>
          {/each}
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Operaciones</span>
            <h2>Incidencias y acciones</h2>
          </div>
        </div>

        <ul class="incident-list">
          {#each selectedInstallation.incidents as incident}
            <li>{incident}</li>
          {/each}
        </ul>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Repositorio</span>
            <h2>Documentos</h2>
          </div>
        </div>

        <div class="document-list">
          {#each selectedInstallation.documents as document}
            <a href="/" on:click|preventDefault>{document}</a>
          {/each}
        </div>
      </section>
    </div>
  </section>
</main>
{/if}
