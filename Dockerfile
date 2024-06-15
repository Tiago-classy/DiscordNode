# Use the official Node.js  image as the base image
FROM node:latest
# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install the required npm packages
RUN npm install
RUN  npm install discord.js, dotenv, node-cron

# Copy the rest of the application code
COPY . .

EXPOSE 8501

HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Command to run the bot
CMD ["node", "bot.js", "--server.port=8501", "--server.address=0.0.0.0"]