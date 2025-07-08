FROM node:20

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy tsconfig and source files
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Expose and start
EXPOSE 3000
CMD ["node", "dist/index.js"]
