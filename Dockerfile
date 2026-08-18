FROM node:20-alpine
WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend source files and build TypeScript
COPY backend/ ./backend/
RUN cd backend && npm run build

# Set environment and expose port
ENV PORT=5000
EXPOSE 5000

# Start compiled Node.js TypeScript server
CMD ["node", "backend/dist/server.js"]
