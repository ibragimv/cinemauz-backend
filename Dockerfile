# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production

# Copy source code
COPY . .

# Expose backend port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
