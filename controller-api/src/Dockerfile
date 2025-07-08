FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and tsconfig.json from parent directory
COPY ../package*.json ./
COPY ../tsconfig.json ./

# Install dependencies
RUN npm install

# Copy the entire arc folder contents (i.e., your source files)
COPY . .

# Build the project
RUN npm run build

# Expose port and start the app
EXPOSE 3000
CMD ["node", "dist/index.js"]
