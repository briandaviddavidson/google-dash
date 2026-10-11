# Cloud Run image for the annotation API.

# Compile the TypeScript server.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json ./
COPY server ./server
RUN npm run build:server

# Runtime: production dependencies and compiled JS only.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build/server ./build/server
USER node
# Cloud Run injects PORT (defaults to 8080); the server honors process.env.PORT.
EXPOSE 8080
CMD ["node", "build/server/index.js"]
