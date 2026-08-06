export default class DelugeClient {
    constructor(baseUrl = "/api", password = "deluge") {
      this.baseUrl = baseUrl;
      this.password = password;
      this.sessionId = null;
      this.passwordPrompted = false;
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
      }
    
      if (data.error) {
        throw new Error(`Deluge RPC error: ${data.error.message}`);
      }
    
      return data.result;
    }

    async login() {
      const result = await this.rpc("auth.login", [this.password]);
  
      if (!result) {
        throw new Error("Deluge login failed");
      }
  
      return true;
    }

    async getTorrents() {
        return this.rpc("web.update_ui", [
            [
                "name",
                "state",
                "progress",
                "download_speed",
                "upload_speed",
                "eta"
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
