export default class DelugeClient {
    constructor(baseUrl = "/api", password = "deluge") {
      this.baseUrl = baseUrl;
      this.password = password;
      this.sessionId = null;
      this.passwordPrompted = false;
      this.loggedIn = false;
      this.storageKey = "deluge-client-state";
      this.restoreSession();
    }

    restoreSession() {
      if (typeof window === "undefined") return;

      try {
        const raw = window.sessionStorage.getItem(this.storageKey);
        if (!raw) return;

        const stored = JSON.parse(raw);
        if (stored.sessionId) {
          this.sessionId = stored.sessionId;
          this.loggedIn = true;
        }
        if (stored.password) {
          this.password = stored.password;
        }
      } catch (error) {
        console.warn("Unable to restore Deluge session", error);
      }
    }

    persistSession() {
      if (typeof window === "undefined") return;

      try {
        window.sessionStorage.setItem(this.storageKey, JSON.stringify({
          sessionId: this.sessionId,
          password: this.password,
        }));
      } catch (error) {
        console.warn("Unable to persist Deluge session", error);
      }
    }

    async promptForPassword() {
      if (typeof window === "undefined" || typeof window.prompt !== "function") {
        throw new Error("Password prompt is not available in this environment");
      }

      const enteredPassword = window.prompt("Enter your Deluge password", "");
      if (enteredPassword === null) {
        throw new Error("Deluge login cancelled");
      }

      this.password = enteredPassword;
      this.passwordPrompted = true;
      this.persistSession();
      return enteredPassword;
    }

    async rpc(method, params = []) {
      const body = JSON.stringify({
        method,
        params,
        id: Date.now()
      });
    
      const res = await fetch(`${this.baseUrl}/json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Deluge-Session": this.sessionId || ""
        },
        body
      });
    
      if (!res.ok) {
        throw new Error(`RPC error: ${res.status} ${res.statusText}`);
      }
    
      const data = await res.json();
    
      // Deluge returns session header AFTER login
      const newSession = res.headers.get("X-Deluge-Session");
      if (newSession) {
        this.sessionId = newSession;
        this.persistSession();
      }
    
      if (data.error) {
        throw new Error(`Deluge RPC error: ${data.error.message}`);
      }
    
      return data.result;
    }

    async login() {
      if (this.loggedIn && this.sessionId) {
        return true;
      }

      try {
        const result = await this.rpc("auth.login", [this.password]);

        if (!result) {
          throw new Error("Deluge login failed");
        }

        this.loggedIn = true;
        this.persistSession();
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('webui-logged-in', { detail: { baseUrl: this.baseUrl } }));
          }
        } catch (e) {
          console.debug('Could not dispatch webui-logged-in event', e);
        }
        return true;
      } catch (error) {
        if (!this.passwordPrompted) {
          await this.promptForPassword();
          return this.login();
        }

        throw error;
      }
    }

    async getHosts() {
        return this.rpc("web.get_hosts", []);
    }

    async getTorrents() {
        return this.rpc("web.update_ui", [
            [
                "name",
                "state",
                "progress",
                "download_speed",
                "upload_speed",
                "eta",
                "total_size",
                "time_added",
                "total_done",
                "total_uploaded",
                "download_payload_rate",
                "upload_payload_rate",
                "ratio"
            ],
            {}
        ]);
    }

    async addMagnet(magnet) {
        return this.rpc("web.add_torrents", [[{ magnet }]]);
    }

    async getTorrentStatus(torrentId) {
        return this.rpc("web.get_torrent_status", [torrentId, [
            "name",
            "state",
            "progress",
            "download_speed",
            "upload_speed",
            "eta",
            "ratio",
            "total_size",
            "num_seeds",
            "num_peers",
            "tracker_host",
            "trackers",
            "files",
            "peers"
        ]]);
    }

    async getTorrentFiles(torrentId) {
        return this.rpc("web.get_torrent_files", [torrentId]);
    }

    async getTorrentPeers(torrentId) {
        return this.rpc("web.get_torrent_peers", [torrentId]);
    }

    async addMagnet(magnet) {
        return this.rpc("web.add_torrents", [[{ magnet }]]);
    }

    async addTorrentFile(base64Data, filename) {
        return this.rpc("web.add_torrents", [[{
            path: filename,
            data: base64Data
        }]]);
    }

    async getTorrentPeers(torrentId) {
        return this.rpc("web.get_torrent_peers", [torrentId]);
    }

    async getTorrentTrackers(torrentId) {
        return this.rpc("web.get_torrent_status", [
            torrentId,
            ["trackers"]
        ]);
    }

    async getTorrentFiles(torrentId) {
        return this.rpc("web.get_torrent_files", [torrentId]);
    }

    async setFilePriorities(torrentId, priorities) {
        return this.rpc("core.set_torrent_options", [
            torrentId,
            { file_priorities: priorities }
        ]);
    }

    async pauseTorrent(torrentId) {
        return this.rpc("core.pause_torrent", [[torrentId]]);
    }

    async resumeTorrent(torrentId) {
        return this.rpc("core.resume_torrent", [[torrentId]]);
    }

    async removeTorrent(torrentId) {
        return this.rpc("core.remove_torrent", [torrentId, false]);
    }

    async removeTorrentAndData(torrentId) {
        return this.rpc("core.remove_torrent", [torrentId, true]);
    }

    async globalPause() {
        return this.rpc("core.pause_all_torrents", []);
    }

    async globalResume() {
        return this.rpc("core.resume_all_torrents", []);
    }

    async setGlobalSpeedLimits(download, upload) {
        return this.rpc("core.set_config", [{
            max_download_speed: download,
            max_upload_speed: upload
        }]);
    }

    async setTorrentSpeedLimits(torrentId, download, upload) {
        return this.rpc("core.set_torrent_options", [
            torrentId,
            {
                max_download_speed: download,
                max_upload_speed: upload
            }
        ]);
    }

    async queueUp(torrentId) {
        return this.rpc("core.queue_up", [[torrentId]]);
    }

    async queueDown(torrentId) {
        return this.rpc("core.queue_down", [[torrentId]]);
    }

    async queueTop(torrentId) {
        return this.rpc("core.queue_top", [[torrentId]]);
    }

    async queueBottom(torrentId) {
        return this.rpc("core.queue_bottom", [[torrentId]]);
    }

    async getConfig() {
        return this.rpc("core.get_config", []);
    }

    async getWebConfig() {
        return this.rpc("web.get_config", []);
    }

    async getSessionStatus(keys = []) {
        return this.rpc("core.get_session_status", [keys]);
    }

    async getFreeSpace(path) {
        return this.rpc("core.get_free_space", [path]);
    }

    async getExternalIp() {
        return this.rpc("core.get_external_ip", []);
    }
    
    async setConfig(options) {
        return this.rpc("core.set_config", [options]);
    }

    async getPlugins() {
        return this.rpc("core.get_available_plugins", []);
    }

    async getEnabledPlugins() {
        return this.rpc("core.get_enabled_plugins", []);
    }

    async enablePlugin(name) {
        return this.rpc("core.enable_plugin", [name]);
    }

    async disablePlugin(name) {
        return this.rpc("core.disable_plugin", [name]);
    }

}

let sharedClientInstance = null;

export function getDelugeClient(baseUrl = "/api", password = null) {
  if (!sharedClientInstance) {
    sharedClientInstance = new DelugeClient(baseUrl, password ?? "70ce453b201ea01ef869c8da62009ed91fb4d83a");
  }

  if (baseUrl) {
    sharedClientInstance.baseUrl = baseUrl;
  }

  if (password !== null && password !== undefined) {
    sharedClientInstance.password = password;
    sharedClientInstance.persistSession();
  }

  return sharedClientInstance;
}
