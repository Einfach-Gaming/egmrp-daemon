# Base
FROM node:20-alpine@sha256:2cd2a6f4cb37cf8a007d5f1e9aef090ade6b62974c7a274098c390599e8c72b4 as base

# Builder
FROM base as builder

# Install yarn.
RUN apk add --update --no-cache yarn

WORKDIR /home/node

# Copy all files required for installing dependencies.
COPY --chown=node:node .yarn/ .yarn/
COPY --chown=node:node ["package.json", "yarn.lock", ".yarnrc.yml", "./"]
# Install all dependencies.
RUN yarn

# Copy all files required for building.
COPY --chown=node:node . .
# Build and remove dev dependencies
RUN yarn build && yarn workspaces focus --production

# Final image
FROM base

USER node
WORKDIR /home/node

ENV NODE_ENV=production

EXPOSE 27200/tcp

# Copy only required files from builder to final image.
COPY --from=builder --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /home/node/package.json ./
COPY --from=builder --chown=node:node /home/node/dist/ ./dist/

WORKDIR /home/node

CMD ["yarn", "start"]
