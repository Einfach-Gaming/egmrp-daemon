# EGM:RP Daemon

Daemon written in TypeScript, which handles cross-game-server networking in realtime.

# How does it work

The EGM:RP framework enables real-time socket communications by implementing `LuaSocket`.
Game servers connect to this daemon which handles authentication and message forwarding.

# Installation / Setup

### **Daemon**

The daemon is run using [Docker](https://www.docker.com/):

```docker
docker run \
  --restart always \
  -p 27200:2700 \
  -v /path/to/whitelist.json:/usr/src/app/whitelist.json \
  registry.gitlab.com/einfach-gaming/gmod/egmrp/daemon
```

This will launch the daemon on port `27200` (the default).

Note that you need to change `/path/to/whitelist.json` to point to a json file on your machine. Every server that is not accessing the daemon locally (through private ip adresses) needs to be explicitly whitelisted using this file.
Here's an example `whitelist.json` file, which will allow connections from `127.0.0.1:27025` and `1.2.3.4:27025`. Note that the port value must not be the game server port but the port that the game server socket listens on (can be configured in EGM:RP with `Socket.LocalPort` (defaults to `27025`).

```json
[
  {
    "ip": "1.2.3.4",
    "port": 27025
  },
  {
    "ip": "5.6.7.8",
    "port": 27025
  }
]
```

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
