// Import the necessary discord.js classes using ES6 syntax
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import cron from 'node-cron';
import fs from 'fs'
// Import everything the commands/ninja.js file exports and store it inside the ninja variable.
import * as int from './commands/ninja.js';
// Call the config() function on dotenv to load the environmental variables from the .env file
config();

// Create a new Discord client instance and define its intents
// Intents are subscriptions to specific events and define what events your bot will receive updates for
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// The URL of the image you want to send
const imageUrl = './assets/welcome.png';
const imageUrl2 = './assets/daily.png';


// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');

    // Schedule a task to send a message every 24 hours
    cron.schedule('0 * * * *', () => {
        sendDailyMessage();
    });
});

// A function executed when the Discord client is ready and connected
function readyDiscord() {
    console.log('🚂 ', client.user.tag);
}

// A function executed when the Discord client receives an interaction
async function handleInteraction(interaction) {
    // Ensure interaction is a command before proceeding
    if (!interaction.isCommand()) return;

    // Command execution mapping
    if (interaction.commandName === 'ninja') {
        await int.execute(interaction);
    }
}

// Function to send daily message to all members
async function sendDailyMessage() {
    const guilds = client.guilds.cache.map(guild => guild);
    for (const guild of guilds) {
        const members = await guild.members.fetch();
        for (const member of members.values()) { // Use .values() to iterate over the collection
            if (member.user && !member.user.bot) {
                try {
                    await member.send({
                        content: fs.readFileSync('./assets/daily.txt').toString(),
                        files: [imageUrl2]
                    });
                    console.log(`Sent a daily message to ${member.user.tag}`);
                } catch (error) {
                    console.error(`Could not send a message to ${member.user.tag}.`, error);
                }
            } else {
                console.log('Skipped an invalid member:', member);
            }
        }
    }
}

// Event listener that executes once when the client successfully connects to Discord
client.once(Events.ClientReady, readyDiscord);

// Event listener for when a slash command is executed
client.on(Events.InteractionCreate, handleInteraction);

// Listen for new guild members
client.on('guildMemberAdd', async member => {
    try {
        // Send a private message to the new member
        await member.send({
            content: fs.readFileSync('./assets/welcome.txt').toString(),
            files: [imageUrl]
        });
        console.log(`Sent a welcome message to ${member.user.tag}`);
    } catch (error) {
        console.error(`Could not send a message to ${member.user.tag}.`, error);
    }
});

// Login to Discord with your bot's token (stored in the .env file)
client.login(process.env.TOKEN);
