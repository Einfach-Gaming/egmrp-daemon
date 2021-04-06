# Base (Debian stretch)
FROM node:14 as base

# Builder
FROM base as builder

# Install yarn.
RUN apt-get update && \
    apt-get install -y curl gnupg apt-transport-https ca-certificates && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn

WORKDIR /home/node

# Copy all files required for installing dependencies.
COPY --chown=node:node .yarn/ .yarn/
COPY --chown=node:node ["package.json", "yarn.lock", ".yarnrc.yml", "./"]
# Install all dependencies.
RUN yarn

# Copy all files required for building.
COPY --chown=node:node . .
# Build and remove dev dependencies
RUN yarn build && yarn --production

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
