# Lightweight Node.js runtime
FROM node:18-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source
COPY . .

# Expose nothing (Discord bot runs outbound only)

# Start the bot
CMD ["npm","start"]
