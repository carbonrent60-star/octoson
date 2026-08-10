import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { requiredEnv } from './env.js';

const DISCORD_TOKEN = requiredEnv('DISCORD_TOKEN');
const CLIENT_ID = requiredEnv('CLIENT_ID');
const { GUILD_ID } = process.env;
const DEPLOY_GLOBAL_COMMANDS = process.env.DEPLOY_GLOBAL_COMMANDS === 'true';

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  if (GUILD_ID) {
    console.log(`Deploying ${commands.length} guild slash commands to ${GUILD_ID}...`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Guild slash commands deployed. They should refresh almost immediately.');
  }

  if (!DEPLOY_GLOBAL_COMMANDS) {
    console.log('Skipping global slash command deploy. Set DEPLOY_GLOBAL_COMMANDS=true to publish globally.');
    process.exit(0);
  }

  console.log(`Deploying ${commands.length} global slash commands...`);
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log('Global slash commands deployed. Discord can take up to 1 hour to refresh global commands everywhere.');
} catch (error) {
  if (error.code === 30034 || error.rawError?.code === 30034) {
    const retryAfter = error.retryAfter ?? error.rawError?.retry_after;
    console.error('Discord refused command creation because the daily application command create limit was reached.');
    if (retryAfter) {
      console.error(`Try again after about ${Math.ceil(Number(retryAfter))} seconds, or when Discord's daily create limit resets.`);
    }
    console.error('Do not run npm run clear. Use npm run deploy or npm run refresh only.');
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
}
