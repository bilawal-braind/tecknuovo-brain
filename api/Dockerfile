# Read API for Azure Container Apps — Tecknuovo Second Brain.
# Small Node service: reads Postgres, serves the dashboards' data + /health.
# All config (PG creds, AUTH_MODE, Entra IDs, CORS) is provided as environment
# variables at deploy time — nothing sensitive is baked in.
FROM node:22-alpine
WORKDIR /app

# Install deps first (better layer caching). npm install works with or without a lockfile.
COPY package*.json ./
RUN npm install

# App source.
COPY . .

ENV PORT=4000
EXPOSE 4000

# Runs `tsx src/server.ts` (see package.json "start").
CMD ["npm", "start"]
