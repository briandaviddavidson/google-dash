# Cloud Run image for the annotation API. Runs the TypeScript server via tsx.
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server ./server

ENV NODE_ENV=production
# Cloud Run injects PORT (defaults to 8080); the server honors process.env.PORT.
EXPOSE 8080

CMD ["npm", "start"]
