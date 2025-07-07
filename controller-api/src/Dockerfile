FROM node:20

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY tsconfig.json ./
COPY . .
RUN npm run build

# Expose and run
EXPOSE 3000
CMD ["node", "dist/index.js"]
