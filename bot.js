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
    // '1248267388105920512': './assets/Flamengo/',
    // '1252279103894065443': './assets/Flamengo/',
    '956003357129076746': './assets/Flamengo/',
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

// Set to keep track of users who have received the daily message
let dailyMessageSent = new Set();

// Function executed once when the Discord client is ready and connected
function readyDiscord() {
    logger.info(`Logged in as ${client.user.tag}`);
    // Schedule a task to reset the dailyMessageSent set every day at 00:00
    cron.schedule('0 0 * * *', () => {
        dailyMessageSent.clear();
        logger.info('Reset daily message sent tracker.');
    });
}

// Function executed when the Discord client receives an interaction
// Event listener for when a slash command is executed
client.on(Events.InteractionCreate, handleInteraction);

// Event listener for when a member's presence updates (e.g., they come online)
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    if ((!oldPresence || oldPresence.status !== 'online') && newPresence.status === 'online') {
        const member = newPresence.member;
        if (!member.user.bot && !dailyMessageSent.has(member.id)) {
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
                logger.info(`Sent a daily message to ${member.user.tag}`);
                dailyMessageSent.add(member.id); // Mark the user as having received the message
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
