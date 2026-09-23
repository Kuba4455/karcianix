FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node src ./src
COPY --chown=node:node web ./web

USER node
EXPOSE 3000
CMD ["node", "src/play-server.ts"]
