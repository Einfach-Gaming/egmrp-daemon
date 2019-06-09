FROM node:10.16.0-alpine

RUN apk add --update --no-cache curl \
  && deluser --remove-home node

USER root
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build \
  && npm prune --production \
  && rm -rf src typings tsconfig.json

EXPOSE 27200/tcp

CMD ["npm", "run", "start"]
