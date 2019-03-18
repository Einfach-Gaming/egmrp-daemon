import dotenv from 'dotenv'
import { find } from 'lodash'
import net from 'net'
import Log from './log'

dotenv.config()

interface IAuthenticatedClient {
  dataBuffer: string
  serverId: number
  serverInfo?: IServerInfo
  initialized: boolean
  socket: net.Socket
}

interface IServerInfo {
  gameI: string
  gamePort: number
  group: string
  name: string
}

// TODO
// interface IMessage {
//   target: Target
// }

enum Target {
  BROADCAST = 'b',
  BROADCAST_GROUP = 'g',
  INFO = 'i',
}

class Daemon extends net.Server {
  public static createServer() {
    return net.createServer()
  }

  private static whitelistedIps = ['127.0.0.1:27015']
  private authenticatedClients: IAuthenticatedClient[] = []

  public constructor() {
    super()

    this.on('connection', this.onConnection.bind(this))
    this.on('error', this.handleError.bind(this))
  }

  // Broadcast a message to all connected clients except the sender
  private broadcastFrom(sender: IAuthenticatedClient, message: string) {
    if (!sender.initialized) {
      throw new Error(
        'Sender needs to be initialized before being able to send messages.'
      )
    }

    for (const client of this.authenticatedClients) {
      if (client.serverId !== sender.serverId) {
        client.socket.write(message + '\n')
      }
    }
  }

  // Broadcasts a message fo all members of a group, ignoring the sender.
  // The target group is the group of the sender.
  private broadcastToGroupFrom(sender: IAuthenticatedClient, message: string) {
    if (!sender.initialized) {
      throw new Error(
        'Sender needs to be initialized before being able to send messages.'
      )
    }

    for (const client of this.authenticatedClients) {
      if (
        client.serverInfo!.group === sender.serverInfo!.group &&
        client.serverId !== sender.serverId
      ) {
        client.socket.write(message + '\n')
      }
    }
  }

  // Sends a message to a single client, identified by the given id.
  private sendMessageToClient(client: IAuthenticatedClient, message: string) {
    if (!client.initialized) {
      throw new Error(
        'Client needs to be initialized before being able to receive messages.'
      )
    }

    client.socket.write(message + '\n')
  }

  private identifyServer(
    client: IAuthenticatedClient,
    serverInfo: IServerInfo
  ) {
    client.serverInfo = serverInfo

    Log.info(`${serverInfo.name} has joined group ${serverInfo.group}`)

    this.announceServerIdentify(client)
  }

  private announceServerIdentify(client: IAuthenticatedClient) {
    // TODO
  }

  private announceServerDisconnect(client: IAuthenticatedClient) {
    const message = JSON.stringify({
      context: 'Disconnect',
      data: client.serverId,
      target: Target.INFO,
    })

    this.broadcastToGroupFrom(client, message)
  }

  private onConnection(socket: net.Socket) {
    socket.setEncoding('binary')

    if (!socket.remoteAddress || !socket.remotePort) {
      Log.warn('Could not identify socket origin, rejecting')
      socket.destroy()
      return
    }

    const ipPort = `${socket.remoteAddress}:${socket.remotePort}`
    if (!Daemon.whitelistedIps.includes(ipPort)) {
      Log.warn(`Socket origin ${ipPort} is not whitelisted, rejecting`)
      socket.destroy()
      return
    }

    this.authenticatedClients.push({
      dataBuffer: '',
      initialized: false,
      serverId: Object.keys(this.authenticatedClients).length + 1,
      socket,
    })

    Log.info(`New socket connection connected from ${ipPort}`)

    socket.on('data', this.onSocketData.bind(this, socket))
    socket.on('close', this.onSocketDisconnect.bind(this, socket))
    socket.on('error', this.handleError.bind(this))
  }

  private onSocketData(socket: net.Socket, data: Buffer) {
    const client = find(this.authenticatedClients, { socket })

    if (!client) {
      Log.info('Ignoring data from unauthenticated socket')
    } else {
      client.dataBuffer += data.toString()

      const bufferedLines = client.dataBuffer.split('\n')
      const lastLine = bufferedLines.pop()

      client.dataBuffer = lastLine === undefined ? '' : lastLine

      for (const line of bufferedLines) {
        Log.debug(
          `Got message from ${socket.remoteAddress}:${
            socket.remotePort
          }: ${line}`
        )

        // TODO: Joi validation here!

        try {
          const content = JSON.parse(line)

          if (typeof content !== 'object') {
            throw new Error('The parsed json needs to be an object.')
          }

          if (typeof content.target === 'string') {
            switch (content.target) {
              case Target.BROADCAST:
                this.broadcastFrom(client, content)
                break
              case Target.BROADCAST_GROUP:
                this.broadcastToGroupFrom(client, content)
                break
              case Target.INFO:
                this.identifyServer(client, content)
                break
            }
          } else if (typeof content.target === 'number') {
            this.sendMessageToClient(content.target, content)
          } else {
            throw new Error(
              'The value for the target attribute must be either string or number.'
            )
          }
        } catch (err) {
          Log.error(`Failed to handle message: ${err.stack || err.message}`)
        }
      }
    }
  }

  private onSocketDisconnect(socket: net.Socket) {
    const authenticatedClient = find(this.authenticatedClients, { socket })

    if (authenticatedClient) {
      this.announceServerDisconnect(authenticatedClient)

      Log.info(`${socket.remoteAddress! + socket.remotePort!} disconnected`)

      this.authenticatedClients.splice(
        this.authenticatedClients.indexOf(authenticatedClient),
        1
      )
    }
  }

  private handleError(err: Error) {
    Log.error(err.stack || err.message)
  }
}

async function start() {
  const server = Daemon.createServer()
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
  await server.listen('0.0.0.0', port)
  Log.info(`Listening on 0.0.0.0:${port}`)
}

start()
