# Build stage
FROM node:20 AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./ 
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine3.22 AS production

WORKDIR /app

# Copy only build artifacts and production dependencies
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules

# Run app
CMD ["node", "build/index.js"]
