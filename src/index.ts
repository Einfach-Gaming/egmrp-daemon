import dotenv from 'dotenv'
import Joi from 'joi'
import { find } from 'lodash'
import net from 'net'
import Log from './log'
import whitelist from './whitelist.json'

dotenv.config()

interface IServerInfo {
  group: string
  ip: string
  name: string
  port: number
}

interface IAuthenticatedClient {
  dataBuffer: string
  serverId: number
  serverInfo?: IServerInfo
  initialized: boolean
  socket: net.Socket
}

enum Target {
  BROADCAST = 'b',
  BROADCAST_GROUP = 'g',
  INFO = 'i',
}

interface IMessage {
  context: string
  data: any
  target: Target | number
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 27200
const server = net.createServer()
const authenticatedClients: IAuthenticatedClient[] = []

// Handle errors by logging their stack / message.
function handleError(err: Error) {
  Log.error(err.stack || err.message)
}

// Finds an unused server id, starting with 1.
function findSpareServerId() {
  let serverId = 1

  while (find(authenticatedClients, { serverId }) !== undefined) {
    serverId++
  }

  return serverId
}

// Broadcasts a message to everybody in the group of the sender, except the sender itself.
function broadcastToGroupFrom(sender: IAuthenticatedClient, message: IMessage) {
  if (!sender.initialized) {
    throw new Error(
      'Sender needs to be initialized before being able to send messages.'
    )
  }

  for (const client of authenticatedClients) {
    if (
      client.serverInfo!.group === sender.serverInfo!.group &&
      client.serverId !== sender.serverId
    ) {
      client.socket.write(JSON.stringify(message) + '\n')
    }
  }
}

// Broadcast a message to all connected clients except the sender.
function broadcastFrom(sender: IAuthenticatedClient, message: IMessage) {
  if (!sender.initialized) {
    throw new Error(
      'Sender needs to be initialized before being able to send messages.'
    )
  }

  for (const client of authenticatedClients) {
    if (client.serverId !== sender.serverId) {
      client.socket.write(JSON.stringify(message) + '\n')
    }
  }
}

// Sends a message to a single client.
function sendMessageToClient(
  receiver: IAuthenticatedClient,
  message: IMessage
) {
  if (!receiver.initialized) {
    throw new Error(
      'Client needs to be initialized before being able to receive messages.'
    )
  }

  receiver.socket.write(JSON.stringify(message) + '\n')
}

// Identifies the server of the given client.
function identifyServer(client: IAuthenticatedClient, message: IMessage) {
  const serverInfoValidationResult = Joi.validate(
    message.data,
    Joi.object().keys({
      group: Joi.string().required(),
      ip: Joi.string().required(),
      name: Joi.string().required(),
      port: Joi.number().required(),
    }),
    {
      abortEarly: false,
      stripUnknown: true,
    }
  )

  if (serverInfoValidationResult.error) {
    throw serverInfoValidationResult.error
  }

  const serverInfo: IServerInfo = serverInfoValidationResult.value
  client.serverInfo = serverInfo
  client.initialized = true

  Log.info(`${serverInfo.name} has joined group ${serverInfo.group}`)

  // Confirm that the identification was successful and send the server id to the client.
  const identifyConfirmation: IMessage = {
    context: 'Identify',
    data: client.serverId,
    target: Target.INFO,
  }

  sendMessageToClient(client, identifyConfirmation)

  // Introduce all currently connected clients to the new client.
  const currentServerMessage: IMessage = {
    context: 'Connect',
    data: {},
    target: Target.INFO,
  }

  for (const existingClient of authenticatedClients) {
    if (
      existingClient.initialized &&
      existingClient.serverInfo!.group === client.serverInfo.group &&
      existingClient.serverId !== client.serverId
    ) {
      sendMessageToClient(
        client,
        Object.assign(currentServerMessage, {
          data: {
            id: authenticatedClients.indexOf(existingClient),
            ip: existingClient.serverInfo!.ip,
            name: existingClient.serverInfo!.name,
            port: existingClient.serverInfo!.port,
          },
        })
      )
    }
  }

  // Introduce the new client to all existing clients.
  const welcomeMessage: IMessage = {
    context: 'Connect',
    data: {
      id: client.serverId,
      ip: client.serverInfo.ip,
      name: client.serverInfo.name,
      port: client.serverInfo.port,
    },
    target: Target.INFO,
  }

  broadcastToGroupFrom(client, welcomeMessage)
}

// Called when a new socket connection is established.
function onSocketConnect(socket: net.Socket) {
  socket.setEncoding('binary')

  if (!socket.remoteAddress || !socket.remotePort) {
    Log.warn('Could not identify socket origin, rejecting')
    socket.destroy()
    return
  }

  if (
    find(whitelist, { ip: socket.remoteAddress, port: socket.remotePort }) ===
    undefined
  ) {
    Log.warn(
      `Socket origin ${socket.remoteAddress}:${
        socket.remotePort
      } is not whitelisted, rejecting`
    )
    socket.destroy()
    return
  }

  authenticatedClients.push({
    dataBuffer: '',
    initialized: false,
    serverId: findSpareServerId(),
    socket,
  })

  Log.info(
    `New socket connection connected from ${socket.remoteAddress}:${
      socket.remotePort
    }`
  )

  socket.on('data', onSocketData.bind(socket))
  socket.on('close', onSocketDisconnect.bind(socket))
  socket.on('error', handleError)
}

// Called when a socket received new data.
function onSocketData(this: net.Socket, data: Buffer) {
  const client = find(authenticatedClients, { socket: this })

  if (client === undefined) {
    Log.info('Ignoring data from unauthenticated socket')
  } else {
    client.dataBuffer += data.toString()

    const bufferedLines = client.dataBuffer.split('\n')
    const lastLine = bufferedLines.pop()

    client.dataBuffer = lastLine === undefined ? '' : lastLine

    for (const line of bufferedLines) {
      Log.debug(
        `Got message from ${this.remoteAddress}:${this.remotePort}: ${line}`
      )

      try {
        const content = JSON.parse(line)
        const contentValidationResult = Joi.validate(
          content,
          Joi.object().keys({
            contxt: Joi.string().required(),
            data: Joi.any().required(),
            target: Joi.alternatives().try(
              Joi.number().required(),
              Joi.string()
                .valid(['b', 'g', 'i'])
                .required()
            ),
          }),
          {
            abortEarly: false,
            stripUnknown: true,
          }
        )

        if (contentValidationResult.error) {
          throw contentValidationResult.error
        }

        const message: IMessage = contentValidationResult.value

        if (typeof message.target === 'string') {
          switch (message.target) {
            case Target.BROADCAST:
              broadcastFrom(client, message)
              break
            case Target.BROADCAST_GROUP:
              broadcastToGroupFrom(client, message)
              break
            case Target.INFO:
              identifyServer(client, message)
              break
          }
        } else if (typeof message.target === 'number') {
          const receiver = find(authenticatedClients, {
            serverId: message.target,
          })

          if (receiver === undefined) {
            throw new Error('Unknown receiver.')
          }

          sendMessageToClient(receiver, message)
        }
      } catch (err) {
        Log.error(`Failed to handle message: ${err.stack || err.message}`)
      }
    }
  }
}

// Called when a socket disconnected.
function onSocketDisconnect(this: net.Socket) {
  const client = find(authenticatedClients, { socket: this })

  if (client !== undefined) {
    // Announce server disconnect.
    const message = {
      context: 'Disconnect',
      data: client.serverId.toString(),
      target: Target.INFO,
    }

    broadcastToGroupFrom(client, message)

    Log.info(`${this.remoteAddress}:${this.remotePort} disconnected`)

    authenticatedClients.splice(authenticatedClients.indexOf(client), 1)
  }
}

async function start() {
  // Handle new connections.
  server.on('connection', onSocketConnect)

  // Error handling.
  server.on('error', handleError)

  // Listen.
  await server.listen(port, '0.0.0.0')
  Log.info(`Listening on 0.0.0.0:${port}`)
}

start()
