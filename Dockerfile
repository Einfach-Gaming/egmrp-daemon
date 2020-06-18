# Builder
FROM node:12-alpine AS builder

RUN apk add --update --no-cache yarn

USER node
WORKDIR /home/node

COPY ["package.json", "yarn.lock", "./"]

# Install all dependencies.
RUN yarn install --frozen-lockfile

# Copy files for buld.
COPY . .

# Build 
RUN yarn build && \
    # Remove dev dependencies.
    yarn install --frozen-lockfile --production

# Final image
FROM node:12-alpine

RUN apk add --update --no-cache curl

USER node
WORKDIR /home/node

COPY ["package.json", "yarn.lock", "./"]

# Install all dependencies.
RUN yarn install --frozen-lockfile

# Copy only required files from builder to final image.
COPY --from=builder --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /home/node/package.json ./
COPY --from=builder --chown=node:node /home/node/dist/ ./dist

EXPOSE 27200/tcp

CMD ["npm", "start"]
