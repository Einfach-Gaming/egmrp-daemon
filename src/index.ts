// Load env variables from our .env config as early as possible.
import net, { AddressInfo } from 'net'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { isPrivate } from 'ip'
import * as Yup from 'yup'
import logger from './logger'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  sender?: number
  target: Target | number
}

const whitelistSchema = Yup.array()
  .of(
    Yup.object({
      ip: Yup.string().required(),
      port: Yup.number().required(),
    }).required()
  )
  .defined()

let whitelist: ReturnType<typeof whitelistSchema.validateSync>

try {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const whitelistJson = fs.readFileSync(path.join(__dirname, '../whitelist.json')).toString()
  whitelist = whitelistSchema.validateSync(JSON.parse(whitelistJson))
} catch (err) {
  logger.error({ err }, 'Failed to load whitelist')
  process.exit(1)
}

const server = net.createServer()
const authenticatedClients: IAuthenticatedClient[] = []

// Log errors.
function handleError(err: Error) {
  logger.error(err)
}

// Finds an unused server id, starting with 1.
function findSpareServerId() {
  let serverId = 1

  while (authenticatedClients.some(client => client.serverId === serverId)) {
    serverId += 1
  }

  return serverId
}

function isServerWhitelisted(ip: string, port: number) {
  return (
    isPrivate(ip) ||
    whitelist.some(
      ({ ip: whitelistedIp, port: whitelistedPort }) =>
        whitelistedIp === ip && whitelistedPort === port
    )
  )
}

// Broadcasts a message to everybody in the group of the sender, except the sender itself.
function broadcastToGroupFrom(sender: IAuthenticatedClient, message: IMessage) {
  if (!sender.initialized) {
    throw new Error(
      'Sender needs to be initialized before being able to send messages.'
    )
  }

  authenticatedClients.forEach(client => {
    if (
      client.initialized &&
      client.serverInfo!.group === sender.serverInfo!.group &&
      client.serverId !== sender.serverId
    ) {
      client.socket.write(`${JSON.stringify(message)}\n`)
    }
  })
}

// Broadcast a message to all connected clients except the sender.
function broadcastFrom(sender: IAuthenticatedClient, message: IMessage) {
  if (!sender.initialized) {
    throw new Error(
      'Sender needs to be initialized before being able to send messages.'
    )
  }

  authenticatedClients.forEach(client => {
    if (client.initialized && client.serverId !== sender.serverId) {
      client.socket.write(`${JSON.stringify(message)}\n`)
    }
  })
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

  receiver.socket.write(`${JSON.stringify(message)}\n`)
}

const serverInfoValidationSchema = Yup.object({
  group: Yup.string().required(),
  ip: Yup.string().required(),
  name: Yup.string().required(),
  port: Yup.number().required(),
}).required()

// Identifies the server of the given client.
async function identifyServer(client: IAuthenticatedClient, message: IMessage) {
  const serverInfo = await serverInfoValidationSchema
    .validate(message.data, { abortEarly: false, stripUnknown: true })
    .catch(err => {
      logger.error({ err }, 'failed to identify server')
    })

  if (serverInfo === undefined) return

  // eslint-disable-next-line no-param-reassign
  client.serverInfo = serverInfo
  // eslint-disable-next-line no-param-reassign
  client.initialized = true

  logger.info(`${serverInfo.name} has joined group ${serverInfo.group}`)

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

  authenticatedClients.forEach(existingClient => {
    if (
      existingClient.initialized &&
      existingClient.serverInfo!.group === client.serverInfo!.group &&
      existingClient.serverId !== client.serverId
    ) {
      sendMessageToClient(
        client,
        Object.assign(currentServerMessage, {
          data: {
            id: existingClient.serverId,
            ip: existingClient.serverInfo!.ip,
            name: existingClient.serverInfo!.name,
            port: existingClient.serverInfo!.port,
          },
        })
      )
    }
  })

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

const contentValidationSchema = Yup.object({
  context: Yup.string().required(),
  data: Yup.mixed().required(),
  sender: Yup.number().notRequired(),
  target: Yup.lazy(value =>
    typeof value === 'number'
      ? Yup.number().required()
      : Yup.string().oneOf(['b', 'g', 'i'])
  ) as Yup.NumberSchema<number> | Yup.StringSchema<Target>,
}).required()

// Called when a socket received new data.
async function onSocketData(this: net.Socket, data: Buffer) {
  const client = authenticatedClients.find(client => client.socket === this)

  if (client === undefined) {
    logger.info('Ignoring data from unauthenticated socket')
  } else {
    client.dataBuffer += data.toString()

    const bufferedLines = client.dataBuffer.split('\n')
    const lastLine = bufferedLines.pop()

    client.dataBuffer = lastLine === undefined ? '' : lastLine

    for (const line of bufferedLines) {
      logger.debug(
        `Got message from ${this.remoteAddress}:${this.remotePort}: ${line}`
      )

      try {
        const content = JSON.parse(line)
        const message = await contentValidationSchema.validate(content, {
          abortEarly: false,
          stripUnknown: true,
        })

        if (typeof message.target === 'string') {
          switch (message.target) {
            case Target.BROADCAST:
              broadcastFrom(client, message)
              break
            case Target.BROADCAST_GROUP:
              broadcastToGroupFrom(client, message)
              break
            case Target.INFO:
              await identifyServer(client, message)
              break
            default:
              throw new Error('Unknown target.')
          }
        } else if (typeof message.target === 'number') {
          const receiver = authenticatedClients.find(
            client => client.serverId === message.target
          )

          if (receiver === undefined) {
            throw new Error('Unknown receiver.')
          }

          sendMessageToClient(receiver, message)
        }
      } catch (err) {
        logger.error({ err }, 'Failed to handle message')
      }
    }
  }
}

// Called when a socket disconnected.
function onSocketDisconnect(this: net.Socket) {
  const client = authenticatedClients.find(client => client.socket === this)

  if (client !== undefined) {
    // Announce server disconnect.
    const message = {
      context: 'Disconnect',
      data: client.serverId,
      target: Target.INFO,
    }

    broadcastToGroupFrom(client, message)

    logger.info(`${this.remoteAddress}:${this.remotePort} disconnected`)

    authenticatedClients.splice(authenticatedClients.indexOf(client), 1)
  }
}

// Called when a new socket connection is established.
function onSocketConnect(socket: net.Socket) {
  if (!socket.remoteAddress || !socket.remotePort) {
    logger.warn('Could not identify socket origin, rejecting')
    socket.end()
    return
  }

  if (!isServerWhitelisted(socket.remoteAddress, socket.remotePort)) {
    logger.warn(
      `Socket origin ${socket.remoteAddress}:${socket.remotePort} is not whitelisted, rejecting`
    )
    socket.end()
    return
  }

  authenticatedClients.push({
    dataBuffer: '',
    initialized: false,
    serverId: findSpareServerId(),
    socket,
  })

  logger.info(
    `New socket connection from ${socket.remoteAddress}:${socket.remotePort}`
  )

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  socket.on('data', onSocketData.bind(socket))
  socket.on('close', onSocketDisconnect.bind(socket))
  socket.on('error', handleError)
}

// Handle new connections.
server.on('connection', onSocketConnect)

// Error handling.
server.on('error', handleError)

// Listen.
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 27200
server.listen(port, process.env.IP ?? '0.0.0.0')

server.on('listening', () => {
  const address = server.address() as AddressInfo | null

  if (address === null) {
    logger.error('Failed to retreive http server address.')
    process.exit(1)
  }

  logger.info(`Ready at http://${address.address}:${address.port}`)
})
