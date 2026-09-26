FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js long.js simhost.js ./
# the simulation and the world map, for the server's own copy of every Focus game (built by build/make.py)
COPY sim ./sim
COPY data ./data
# long games are kept here (a volume in compose.yml)
RUN mkdir -p /data && chown node:node /data
ENV LONG_DIR=/data
USER node
CMD ["node", "server.js"]
