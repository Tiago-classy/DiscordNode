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
        GatewayIntentBits.DirectMessages
    ]
});

// Mapping of server IDs to their respective asset directories
const serverAssets = {
    '1252279103894065443': './assets/Flamengo/',
    // Add more server IDs and their respective directories as needed
};

// Function to generate a random number between min and max (inclusive)
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Function executed once when the Discord client is ready and connected
function readyDiscord() {
    logger.info(`Logged in as ${client.user.tag}`);
    sendDailyMessage();
    // Schedule a task to send a message every 24 hours
    // cron.schedule('0 23 * * *', () => { // Changed to run daily at 13.07
    //     sendDailyMessage();
    // });
}

// Function executed when the Discord client receives an interaction
async function handleInteraction(interaction) {
    // Ensure interaction is a command before proceeding
    if (!interaction.isCommand()) return;

    // Command execution mapping
    if (interaction.commandName === 'beClever') {
        await int.execute(interaction);
    }
}

// Function to send daily message to all members
async function sendDailyMessage() {
    const guilds = client.guilds.cache.map(guild => guild);
    for (const guild of guilds) {
        const members = await guild.members.fetch();
        logger.debug(`Fetched members for guild ${guild.id}: ${members.size}`);
        const assetsPath = serverAssets[guild.id];
        if (!assetsPath) {
            logger.warn(`No assets configured for guild ${guild.id}`);
            continue;
        }
        let count = 0;
        for (const member of members.values()) { // Use .values() to iterate over the collection
            if (member.user && !member.user.bot) {
                try {
                    const message = await member.send({
                        content: `Hello ${member.user.username},\n${fs.readFileSync(`${assetsPath}daily.txt`).toString()}`,
                        files: [`${assetsPath}daily.png`]
                    });

                    // Log status response and headers
                    logger.info(`Sent a daily message to ${member.user.tag}`);
                    // No direct HTTP response to log, as member.send() handles it internally
                } catch (error) {
                    if (error.httpStatus) {
                        logger.error(`Could not send a message to ${member.user.tag}. HTTP Status Code: ${error.httpStatus}`);
                    } else {
                        logger.error(`Could not send a message to ${member.user.tag}.`, error);
                    }
                }
                count++;
                if (count % 4 === 0) {
                    const randomSleepTime = getRandomInt(1000, 4000);
                    await sleep(randomSleepTime); // Add a random delay between 1 to 4 seconds after every 3 members
                }
                if (count % 100 === 0) {
                    await sleep(40000); // Add a fixed delay of 40 seconds after every 300 members
                }
                if (count % 1000 === 0) {
                    break // Add a fixed delay of 40 seconds after every 300 members
                }
            } else {
                logger.debug('Skipped an invalid member:', member);
            }
        }
    }
}

// Event listener executed once when the client successfully connects to Discord
client.once(Events.ClientReady, readyDiscord);

// Event listener for when a slash command is executed
client.on(Events.InteractionCreate, handleInteraction);

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
client.login(process.env.TOKEN);
