<script setup>
import { ref, onMounted } from 'vue';
import { getDelugeClient } from '../rpc/delugeClient';

const daemons = ref([]);
const editing = ref(null);
const status = ref('');
const source = ref('deluge');

function newDaemon() {
  editing.value = { id: Date.now(), name: '', host: '127.0.0.1', port: 58846, ssl: false, password: '' };
}

function editDaemon(d) { editing.value = { ...d }; }
function saveDaemon() { /* optional: persist to localStorage if wanted */ editing.value = null; }
function cancelEdit() { editing.value = null; }

// Parse host entries returned by Deluge.
// Deluge returns tuples like: [host_id, hostname, port, username]
function parseHostEntry(h) {
  if (!h) return null;

  if (Array.isArray(h)) {
    const host_id = h[0];
    const host = h[1] || '127.0.0.1';
    const port = Number(h[2] || 58846);
    const name = h[3] || '';
    return { id: host_id || `${host}:${port}`, host, port, name };
  }

  if (typeof h === 'string') {
    const at = h.indexOf('@');
    let name = '';
    let hostport = h;
    if (at !== -1) {
      name = h.substring(0, at);
      hostport = h.substring(at + 1);
    }
    const parts = hostport.split(':');
    const host = parts[0] || '127.0.0.1';
    const port = Number(parts[1] || 58846);
    return { id: `${host}:${port}`, host, port, name };
  }

  if (typeof h === 'object') {
    return {
      id: h.id || h.host || `${h.address || '127.0.0.1'}:${h.port || 58846}`,
      host: h.host || h.address,
      port: h.port || 58846,
      name: h.name || h.client || ''
    };
  }

  return null;
}

function parseHostStatus(st) {
  // st can be an array like [host_id, 'Connected', '2.2.0']
  // or an object with fields. Normalize to { status, version }.
  if (!st) return { status: 'Unknown', version: '' };

  if (Array.isArray(st)) {
    const statusStr = st[1] || '';
    const version = st[2] || '';
    const status = /connected|online/i.test(statusStr) ? 'Online' : ( /offline|disconnected/i.test(statusStr) ? 'Offline' : statusStr );
    return { status, version };
  }

  if (typeof st === 'object') {
    const status = st.connected === true || st.status === 'Connected' || st.status === 'Online' ? 'Online' : (st.status || (st.connected ? 'Online' : 'Offline'));
    const version = st.version || st.client_version || '';
    return { status, version };
  }

  // fallback
  return { status: String(st), version: '' };
}

async function refresh() {
  const client = getDelugeClient();
  status.value = 'Refreshing host list...';
  try {
    // Ensure we're logged into the web UI (may prompt for password)
    try {
      await client.login();
    } catch (loginErr) {
      console.debug('Login failed or cancelled while refreshing hosts:', loginErr && loginErr.message);
      status.value = 'Not logged into web UI; cannot fetch hosts.';
      source.value = 'local';
      daemons.value = [];
      return;
    }

    const candidateMethods = [
      'web.get_hosts',       // documented endpoint
      'web.get_daemon_list',
      'daemon.get_hosts',
      'web.get_servers',
      'core.get_daemons'
    ];

    let found = false;
    for (const m of candidateMethods) {
      try {
        const res = await client.rpc(m, []);
        console.debug('RPC', m, 'response:', res);

        // Extract possible arrays/lists from common shapes
        const items = Array.isArray(res)
          ? res
          : (res && (res.list || res.hosts || res.host_list) ? (res.list || res.hosts || res.host_list) : []);

        const parsed = Array.isArray(items) ? items.map(parseHostEntry).filter(Boolean) : [];

        if (parsed.length > 0) {
          daemons.value = parsed;
          source.value = 'deluge';
          found = true;

          // populate status/version where possible
          for (const h of daemons.value) {
            try {
              const st = await client.rpc('web.get_host_status', [h.id]);
              console.debug('RPC get_host_status response for', h.id, ':', st);
              const info = parseHostStatus(st);
              h.status = info.status;
              h.version = info.version;
            } catch (e) {
              console.debug('get_host_status failed for', h.id, e && e.message);
              h.status = h.status || 'Offline';
              h.version = h.version || '';
            }
          }

          break;
        }
      } catch (err) {
        console.debug('RPC', m, 'failed:', err && err.message);
      }
    }

    if (!found) {
      source.value = 'local';
      daemons.value = [];
      status.value = 'No hosts returned by web UI.';
    } else {
      status.value = '';
    }
  } catch (err) {
    console.error('Unexpected error fetching hosts', err);
    source.value = 'local';
    daemons.value = [];
    status.value = `Error fetching hosts: ${err && err.message}`;
  }
}

async function connect(d) {
  const client = getDelugeClient();
  if (d.connecting) return;
  d.connecting = true;
  status.value = 'Connecting...';

  // Fire the connect RPC but don't await it (it may block until daemon connect completes)
  client.rpc('web.connect', [d.id]).catch((e) => {
    console.debug('web.connect RPC error (background):', e && e.message);
  });

  // Poll web.connected until true or timeout
  const waitForConnected = async (timeoutMs = 15000, intervalMs = 1000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await client.rpc('web.connected', []);
        const connected = (typeof res === 'boolean') ? res : (res && (res.result === true || res === true));
        if (connected) return true;
      } catch (e) {
        console.debug('web.connected check error:', e && e.message);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  };

  try {
    const ok = await waitForConnected(20000, 1000); // wait up to 20s
    if (ok) {
      status.value = `Connected to ${d.name || d.host}`;
      window.dispatchEvent(new CustomEvent('connected', { detail: { hostId: d.id } }));
      // refresh host list/status after connect
      await refresh();
    } else {
      status.value = `Connect timed out; it may still be connecting in the background.`;
      // Optionally refresh to show eventual state changes
      setTimeout(() => refresh(), 2000);
    }
  } catch (e) {
    console.error('Connect/poll error', e);
    status.value = `Connect failed: ${e && e.message}`;
  } finally {
    d.connecting = false;
  }
}

onMounted(() => { refresh(); });
</script>

<template>
  <div class="conn-modal">
    <div class="conn-window">
      <h3>Connection Manager (Deluge)</h3>
      <div>Source: {{ source }} <button @click="refresh">Refresh</button></div>
      <table class="hosts">
        <thead><tr><th>Status</th><th>Host</th><th>Port</th><th>Version</th><th>Name</th><th></th></tr></thead>
        <tbody>
          <tr v-for="h in daemons" :key="h.id">
            <td>{{ h.status || '—' }}</td>
            <td>{{ h.host }}</td>
            <td>{{ h.port }}</td>
            <td>{{ h.version || '—' }}</td>
            <td>{{ h.name || '—' }}</td>
            <td>
              <button :disabled="h.connecting" @click.prevent="connect(h)">
                {{ h.connecting ? 'Connecting...' : 'Connect' }}
              </button>
            </td>
          </tr>
          <tr v-if="daemons.length===0"><td colspan="6">No daemons discovered.</td></tr>
        </tbody>
      </table>
      <div class="status" v-if="status">{{ status }}</div>
      <div class="controls"><button @click="$emit('close')">Close</button></div>
    </div>
  </div>
</template>

<style scoped>
.conn-modal { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.4); }
.conn-window { background: var(--bg); padding: 16px; border-radius: 8px; width: 720px; max-width: 95%; }
.hosts { width:100%; border-collapse: collapse; margin-bottom:8px; }
.hosts th, .hosts td { border-bottom: 1px solid var(--border); padding: 6px 8px; text-align:left; }
.status { margin-top:8px; color: var(--text); }
.controls { margin-top:8px; }
</style>