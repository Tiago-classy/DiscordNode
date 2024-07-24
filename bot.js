// Import necessary modules
import { config } from 'dotenv';
import pkg from 'discord.js';
const { Client, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = pkg;
import fs from 'fs';
import winston from 'winston'; // Import winston for logging
import cron from 'node-cron'; // Import cron for scheduling tasks
import sqlite3 from 'sqlite3'; // Import sqlite3 for database operations
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

// Open the database
const db = new sqlite3.Database('./user_preferences.db');

// Create a table to store user preferences
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        tag_status TEXT
    )`);
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
    '1248267388105920512': './assets/Flamengo/',
    '1252279103894065443': './assets/Flamengo/',
    // '956003357129076746': './assets/Flamengo/',
    // Add more server IDs and their respective directories as needed
};

// In-memory user-guild mapping
const userGuildMap = new Map();

// A function executed when the Discord client receives an interaction
async function handleInteraction(interaction) {
    // Ensure interaction is a command or button interaction before proceeding
    if (!interaction.isCommand() && !interaction.isButton()) return;

    // Command execution mapping
    if (interaction.isCommand() && interaction.commandName === 'ninja') {
        await int.execute(interaction);
    }

    // Handle button interactions
    if (interaction.isButton()) {
        const userId = interaction.user.id;

        if (interaction.customId === 'tag_yes') {
            db.run(`INSERT OR REPLACE INTO user_preferences (user_id, tag_status) VALUES (?, ?)`, [userId, 'tag_yes'], (err) => {
                if (err) {
                    logger.error(`Could not save preference for user ${userId}.`, err);
                }
            });
            await interaction.reply({ content: 'You will receive the odds!', ephemeral: true });
        } else if (interaction.customId === 'tag_no') {
            db.run(`INSERT OR REPLACE INTO user_preferences (user_id, tag_status) VALUES (?, ?)`, [userId, 'tag_no'], (err) => {
                if (err) {
                    logger.error(`Could not save preference for user ${userId}.`, err);
                }
            });
            await interaction.reply({ content: 'You have chosen not to receive the odds.', ephemeral: true });
        } else if (interaction.customId === 'disable_tag') {
            db.run(`DELETE FROM user_preferences WHERE user_id = ?`, [userId], (err) => {
                if (err) {
                    logger.error(`Could not remove preference for user ${userId}.`, err);
                }
            });
            await interaction.reply({ content: 'You have been untagged.', ephemeral: true });
        }
    }
}

// Function executed once when the Discord client is ready and connected
async function readyDiscord() {
    logger.info(`Logged in as ${client.user.tag}`);
    // Schedule a task to send a message to tagged users every 12 hours
    cron.schedule('*/3 * * * *', () => {
        db.each(`SELECT user_id FROM user_preferences WHERE tag_status = 'tag_yes'`, async (err, row) => {
            if (err) {
                logger.error('Error fetching tagged users from the database.', err);
                return;
            }
            try {
                const user = await client.users.fetch(row.user_id);
                if (user) {
                    await user.send('Aqui tens as melhores BET do dia! Aposta connosco. Ninjabet.com');
                    logger.info(`Sent a scheduled message to ${user.tag}`);
                }
            } catch (error) {
                logger.error(`Could not send a message to user ${row.user_id}.`, error);
            }
        });
    });
}

// Event listener for when a slash command is executed
client.on(Events.InteractionCreate, handleInteraction);

// Event listener for new guild members
client.on(Events.GuildMemberAdd, async member => {
    const assetsPath = serverAssets[member.guild.id];
    if (!assetsPath) {
        logger.warn(`No assets configured for guild ${member.guild.id}`);
        return;
    }
    try {
        // Store user-guild mapping
        userGuildMap.set(member.user.id, member.guild.id);

        // Send a private message to the new member with buttons
        await member.send({
            files: [`${assetsPath}welcome.png`],
            content: fs.readFileSync(`${assetsPath}welcome.txt`).toString(),

            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tag_yes')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('tag_no')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger),
          
                )
            ]
        });
        logger.info(`Sent a welcome message to ${member.user.tag}`);
    } catch (error) {
        logger.error(`Could not send a message to ${member.user.tag}.`, error);
    }
});

// Login to Discord with your bot's token (stored in the .env file)
client.once(Events.ClientReady, readyDiscord);
client.login(process.env.TOKEN);
