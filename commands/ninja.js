// Importing modules using ES6 syntax
import { SlashCommandBuilder } from 'discord.js';

// Command Builder export
export const data = new SlashCommandBuilder()
  .setName('ninja')
  .setDescription('MAGIC!');

// Execute function export
export async function execute(interaction) {
    console.log('Ninja touched a tua prima')
  await interaction.reply("It's done boss!");
}