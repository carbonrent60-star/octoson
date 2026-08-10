import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { requiredEnv } from './env.js';

const DISCORD_TOKEN = requiredEnv('DISCORD_TOKEN');
const CLIENT_ID = requiredEnv('CLIENT_ID');
const { GUILD_ID } = process.env;
const CONFIRM_CLEAR_COMMANDS = process.env.CONFIRM_CLEAR_COMMANDS === 'true';

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  if (!CONFIRM_CLEAR_COMMANDS) {
    console.error('Refusing to clear commands. Set CONFIRM_CLEAR_COMMANDS=true only when you intentionally want every slash command removed.');
    process.exit(1);
  }

  if (GUILD_ID) {
    console.log('Clearing guild commands...');
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    } catch (error) {
      if (error.code === 50001) {
        console.warn('Skipping guild command clear: bot has no access to that GUILD_ID.');
      } else {
        throw error;
      }
    }
  }

  console.log('Clearing global commands...');
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

  console.log('Commands cleared. Run npm run deploy to publish the new set.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
