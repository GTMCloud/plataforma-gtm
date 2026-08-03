<script>
  import { onMount } from 'svelte'

  let currentUser = null
  let token = ''
  let email = 'gtm@gtm.es'
  let password = 'gtm2026'
  let loginError = ''
  let loading = false
  let installations = []
  let selectedId = ''

  $: selectedInstallation = installations.find((installation) => installation.id === selectedId)
    ?? installations[0]
  $: totalAlerts = installations.reduce(
    (total, installation) => total + Number(installation.metrics[2]?.value ?? 0),
    0
  )
  $: averageHealth = installations.length
    ? Math.round(
        installations.reduce((total, installation) => total + installation.health, 0) /
          installations.length
      )
    : 0

  onMount(async () => {
    const storedToken = localStorage.getItem('gtm_token')
    const storedUser = localStorage.getItem('gtm_user')

    if (!storedToken || !storedUser) return

    token = storedToken
    currentUser = JSON.parse(storedUser)
    await loadInstallations()
  })

  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error ?? 'Error de comunicacion con la API')
    return payload
  }

  async function loadInstallations() {
    loading = true

    try {
      const data = await apiFetch('/api/installations')
      installations = data.installations
      selectedId = data.installations[0]?.id ?? ''
    } catch (error) {
      const message = error.message
      handleLogout()
      loginError = message
    } finally {
      loading = false
    }
  }

  async function handleLogin() {
    loading = true
    loginError = ''

    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      token = data.token
      currentUser = data.user
      localStorage.setItem('gtm_token', token)
      localStorage.setItem('gtm_user', JSON.stringify(currentUser))
      await loadInstallations()
    } catch (error) {
      loginError = error.message
    } finally {
      loading = false
    }
  }

  function handleLogout() {
    currentUser = null
    token = ''
    password = ''
    installations = []
    selectedId = ''
    localStorage.removeItem('gtm_token')
    localStorage.removeItem('gtm_user')
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

        <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>

        <div class="demo-users">
          <strong>Accesos iniciales</strong>
          <span>GTM: gtm@gtm.es / gtm2026</span>
          <span>Productos Lozano: cliente@productoslozano.es / lozano2026</span>
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
        <span>{installations.length} obras visibles</span>
        <strong>{averageHealth}% salud media</strong>
      </div>

      <div class="user-card">
        <span>{currentUser.role === 'gtm' ? 'Usuario GTM' : 'Cliente'}</span>
        <strong>{currentUser.name}</strong>
        <button type="button" on:click={handleLogout}>Cerrar sesion</button>
      </div>

      <nav class="installation-list">
        {#each installations as installation}
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
      {#if loading}
        <section class="panel empty-state">
          <span class="eyebrow">Cargando</span>
          <h2>Obteniendo datos de la plataforma</h2>
        </section>
      {:else if selectedInstallation}
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
      {:else}
        <section class="panel empty-state">
          <span class="eyebrow">Sin instalaciones</span>
          <h2>No hay obras asociadas a este usuario</h2>
        </section>
      {/if}
    </section>
  </main>
{/if}
