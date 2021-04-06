import net, { AddressInfo } from 'net'
import fs from 'fs'
import path from 'path'
import * as Yup from 'yup'
import { logger } from './logger'
import { isPrivateIP } from './utils'

interface SeverInfo {
  group: string
  ip: string
  name: string
  port: number
}

interface AuthenticatedClient {
  dataBuffer: string
  serverId: number
  serverInfo?: SeverInfo
  initialized: boolean
  socket: net.Socket
}

enum Target {
  BROADCAST = 'b',
  BROADCAST_GROUP = 'g',
  INFO = 'i',
}

interface Message {
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
  const whitelistJson = fs
    .readFileSync(path.join(__dirname, '../whitelist.json'))
    .toString()
  whitelist = whitelistSchema.validateSync(JSON.parse(whitelistJson))
} catch (err) {
  logger.error({ err }, 'Failed to load whitelist')
  process.exit(1)
}

const server = net.createServer()
const authenticatedClients: AuthenticatedClient[] = []

function handleError(err: Error) {
  logger.error(err)
}

function findSpareServerId() {
  let serverId = 1

  while (authenticatedClients.some(client => client.serverId === serverId)) {
    serverId += 1
  }

  return serverId
}

function isServerWhitelisted(ip: string, port: number) {
  return (
    isPrivateIP(ip) ||
    whitelist.some(
      ({ ip: whitelistedIp, port: whitelistedPort }) =>
        whitelistedIp === ip && whitelistedPort === port
    )
  )
}

function broadcastToGroupFrom(sender: AuthenticatedClient, message: Message) {
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

function broadcastFrom(sender: AuthenticatedClient, message: Message) {
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

function sendMessageToClient(receiver: AuthenticatedClient, message: Message) {
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

async function identifyServer(client: AuthenticatedClient, message: Message) {
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
  const identifyConfirmation: Message = {
    context: 'Identify',
    data: client.serverId,
    target: Target.INFO,
  }

  sendMessageToClient(client, identifyConfirmation)

  // Introduce all currently connected clients to the new client.
  const currentServerMessage: Message = {
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
  const welcomeMessage: Message = {
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
      : (Yup.string()
          .oneOf(Object.values(Target))
          .required() as Yup.StringSchema<Target>)
  ),
}).required()

// Called when a socket received new data.
async function onSocketData(socket: net.Socket, data: Buffer) {
  const client = authenticatedClients.find(client => client.socket === socket)

  if (client === undefined) {
    logger.info('Ignoring data from unauthenticated socket')
  } else {
    client.dataBuffer += data.toString()

    const bufferedLines = client.dataBuffer.split('\n')
    const lastLine = bufferedLines.pop()

    client.dataBuffer = lastLine === undefined ? '' : lastLine

    for (const line of bufferedLines) {
      logger.debug(
        `Got message from ${socket.remoteAddress}:${socket.remotePort}: ${line}`
      )

      let content
      try {
        content = JSON.parse(line)
      } catch (err) {
        logger.error({ err }, 'Failed to read line of socket data')
        return
      }

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
            logger.error('Unknown target')
            return
        }
      } else if (typeof message.target === 'number') {
        const receiver = authenticatedClients.find(
          client => client.serverId === message.target
        )

        if (receiver === undefined) {
          logger.error('Unknown receiver')
          return
        }

        sendMessageToClient(receiver, message)
      }
    }
  }
}

// Called when a socket disconnected.
function onSocketDisconnect(socket: net.Socket) {
  const client = authenticatedClients.find(client => client.socket === socket)

  if (client !== undefined) {
    // Announce server disconnect.
    const message = {
      context: 'Disconnect',
      data: client.serverId,
      target: Target.INFO,
    }

    broadcastToGroupFrom(client, message)

    logger.info(`${socket.remoteAddress}:${socket.remotePort} disconnected`)

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

  socket.on('data', data => void onSocketData(socket, data))
  socket.on('close', () => onSocketDisconnect(socket))
  socket.on('error', handleError)
}

server.on('connection', onSocketConnect)
server.on('error', handleError)

const host = process.env.HOST ?? '0.0.0.0'
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 27200
server.listen(port, host)

server.on('listening', () => {
  const address = server.address() as AddressInfo | null

  if (address === null) {
    logger.error('Failed to retreive http server address.')
    process.exit(1)
  }

  logger.info(`Ready at http://${address.address}:${address.port}`)
})
