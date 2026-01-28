# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Expose port for remote development server
EXPOSE 8787

# Default command runs remote development
CMD ["npx", "wrangler", "dev", "--remote"]
