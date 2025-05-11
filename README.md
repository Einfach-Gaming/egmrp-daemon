# EGM:RP Daemon

Daemon written in Golang, which handles cross-game-server networking in realtime.

# How does it work

The EGM:RP framework enables real-time socket communications by implementing `LuaSocket`.
Game servers connect to this daemon which handles authentication and message forwarding.

# Installation / Setup

### **Daemon**

The daemon is run using [Docker](https://www.docker.com/):

```docker
docker run -d \
  --name egmrp-daemon \
  --restart always \
  -p 27200:27200 \
  -e WHITELIST=1.2.3.4:27125,5.6.7.8:27125 \
  ghcr.io/einfach-gaming/egmrp-daemon:latest
```

This will launch the daemon on port `27200` (the default).

Every server that is not accessing the daemon locally (through private ip adresses) needs to be explicitly whitelisted using the whitelist env variable.
See the example above to whitelist `1.2.3.4:27125` and `5.6.7.8:27125`.
Note that the port value must not be the game server port but the port that the game server socket listens on (can be configured in EGM:RP with `Socket.LocalPort` (defaults to `27025`).

### **EGM:RP**

In order for EGM:RP to handle socket connections, you need to enable required modules.

1. Download `includes.7z` and `gmsv_socket.core_{your-distro}.dll` from https://github.com/danielga/gmod_luasocket/releases
2. Copy `gmsv_socket.core_{your-distro}.dll` to `garrysmod/lua/bin` (create folder if it does not yet exist).
3. Extract `includes.7z` to `/garrysmod/lua`. After the process, this and more files should exist: `/garrysmod/lua/includes/modules/socket.lua`
4. Edit `/garrysmod/gamemodes/your-gamemode/gamemode/config/gamemode.lua` to include the following:

```lua
-- The base api for socket connections.
Config.Modules["socket"] = true

-- Consumes the socket api to implement things like synced property models, synced player count, cross-server chat and more (see config for details).
Config.Modules["multiserver"] = true

-- If you want to show synced player counts inside the server name.
-- This module also has other features (see the config for details).
Config.Modules["hostname"] = true
```

# Credits

[Diego Nehab](https://github.com/diegonehab) for [LuaSocket](https://github.com/diegonehab/luasocket)

[Daniel](https://github.com/danielga) for the [gmod implementation of LuaSocket](https://github.com/danielga/gmod_luasocket)