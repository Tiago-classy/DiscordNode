// Import necessary modules
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import winston from 'winston'; // Import winston for logging
import * as int from './commands/ninja.js'; // Import commands

// Call dotenv config function to load environment variables
config();

// Configure winston logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' }) // Optional: Log to a file
    ]
});

// Create a new Discord client instance with defined intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences // Required to detect when users come online
    ]
});

// Mapping of server IDs to their respective asset directories
const serverAssets = {
    '1248267388105920512': './assets/Flamengo/',
    '1252279103894065443': './assets/Flamengo/',
    // Add more server IDs and their respective directories as needed
};

// Function to generate a random number between min and max (inclusive)
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Sleep function for adding delays
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// A function executed when the Discord client receives an interaction
async function handleInteraction(interaction) {
    // Ensure interaction is a command before proceeding
    if (!interaction.isCommand()) return;

    // Command execution mapping
    if (interaction.commandName === 'ninja') {
        await int.execute(interaction);
    }
}

// Function executed once when the Discord client is ready and connected
function readyDiscord() {
    logger.info(`Logged in as ${client.user.tag}`);
    // Schedule a task to send the daily message at 11:00 AM
    cron.schedule('0 11 * * *', () => {
        prepareDailyMessages();
    });
}

// Function executed when the Discord client receives an interaction
// Event listener for when a slash command is executed
client.on(Events.InteractionCreate, handleInteraction);

// Array to keep track of users who should receive daily messages
let dailyUsersQueue = [];

// Function to prepare the daily messages queue
async function prepareDailyMessages() {
    dailyUsersQueue = []; // Reset the queue
    const guilds = client.guilds.cache.map(guild => guild);
    for (const guild of guilds) {
        const members = await guild.members.fetch();
        logger.debug(`Fetched members for guild ${guild.id}: ${members.size}`);
        const assetsPath = serverAssets[guild.id];
        if (!assetsPath) {
            logger.warn(`No assets configured for guild ${guild.id}`);
            continue;
        }
        for (const member of members.values()) {
            if (member.user && !member.user.bot && member.presence?.status === 'online') {
                dailyUsersQueue.push(member);
            }
        }
    }
}

// Function to process the queue of daily users
async function processDailyQueue() {
    if (dailyUsersQueue.length === 0) {
        return;
    }

    const batch = dailyUsersQueue.splice(0, 200);
    for (const member of batch) {
        const assetsPath = serverAssets[member.guild.id];
        if (!assetsPath) {
            logger.warn(`No assets configured for guild ${member.guild.id}`);
            continue;
        }
        try {
            await member.send({
                content: `Hello ${member.user.username},\n${fs.readFileSync(`${assetsPath}daily.txt`).toString()}`,
                files: [`${assetsPath}daily.png`]
            });
            logger.info(`Sent a daily message to ${member.user.tag}`);
        } catch (error) {
            logger.error(`Could not send a message to ${member.user.tag}.`, error);
        }
    }
}

// Schedule the daily message queue processing every 30 minutes
cron.schedule('*/30 * * * *', processDailyQueue);

// Event listener for when a member's presence updates (e.g., they come online)
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    if ((!oldPresence || oldPresence.status !== 'online') && newPresence.status === 'online') {
        const member = newPresence.member;
        if (!member.user.bot && !dailyUsersQueue.some(user => user.id === member.id)) {
            const assetsPath = serverAssets[member.guild.id];
            if (!assetsPath) {
                logger.warn(`No assets configured for guild ${member.guild.id}`);
                return;
            }
            try {
                await member.send({
                    content: `Hello ${member.user.username},\n${fs.readFileSync(`${assetsPath}daily.txt`).toString()}`,
                    files: [`${assetsPath}daily.png`]
                });
                logger.info(`Sent an online message to ${member.user.tag}`);
            } catch (error) {
                logger.error(`Could not send a message to ${member.user.tag}.`, error);
            }
        }
    }
});

// Event listener for new guild members
client.on('guildMemberAdd', async member => {
    const assetsPath = serverAssets[member.guild.id];
    if (!assetsPath) {
        logger.warn(`No assets configured for guild ${member.guild.id}`);
        return;
    }
    try {
        // Send a private message to the new member
        await member.send({
            content: fs.readFileSync(`${assetsPath}welcome.txt`).toString(),
            files: [`${assetsPath}welcome.png`]
        });
        logger.info(`Sent a welcome message to ${member.user.tag}`);
    } catch (error) {
        logger.error(`Could not send a message to ${member.user.tag}.`, error);
    }
});

// Login to Discord with your bot's token (stored in the .env file)
client.once(Events.ClientReady, readyDiscord);
client.login(process.env.TOKEN);
