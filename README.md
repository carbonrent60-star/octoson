# October Looks Bot

A polished Azerbaijani Discord bot for October's community. It focuses on useful style advice, routines, profile polish, clean live announcements, and optional AI replies in a chosen channel.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` and fill in:

```bash
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
AI_CHANNEL_ID=...
AI_REPLY_TO_MENTIONS=true
ENABLE_MESSAGE_CONTENT=false
```

3. Clear old slash commands for this app, then deploy the global command set:

```bash
npm run clear
npm run deploy
```

Invite link:

```text
https://discord.com/oauth2/authorize?client_id=725807798117597195&permissions=84992&scope=bot%20applications.commands
```

4. Start the bot:

```bash
npm start
```

## Commands

- `/panel` - main bot panel with buttons.
- `/start` - beginner-friendly start panel.
- `/commands` - command map explaining what each command group does.
- `/help` - guided help for Aura, games, missions, and inventory.
- `/stylecheck` - opens a modal and gives a practical style review.
- `/routine` - skin, hair, posture, or photo routine.
- `/profile` - TikTok/Discord profile polish.
- `/ask` - direct AI style/content question.
- `/livepanel` - clean live announcement panel.
- `/game` - legacy Aura menu, balance, daily, slots, risk, duel, leaderboard, and prestige.
- `/wallet` - balance, bank, deposit, withdraw, transfer, gift, history, interest, and taxes.
- `/earn` - daily, weekly, monthly, work, crime, hunt, fish, mine, beg, rob, collect, rewards, and bonus.
- `/inventory` - profile, items, shop, buy, sell, open, craft, recycle, salvage, achievements, badges, titles, statistics, and settings.
- `/casino` - slots, risk, coinflip, dice, roulette, blackjack, crash, mines, tower, higher/lower, wheel, lottery, jackpot, and rock paper scissors.
- Casino betting uses a per-user limit based on bank and balance, has a per-user cooldown, and uses house-edge payouts so the economy stays balanced.

## AI Replies

AI replies are disabled unless `OPENAI_API_KEY` is set.

`/ask` works without privileged Discord intents.

Normal channel replies require `ENABLE_MESSAGE_CONTENT=true` and Discord's privileged `Message Content Intent`. For verified bots, Discord must approve that intent before the bot can use it. If it is not approved, leave `ENABLE_MESSAGE_CONTENT=false`.

`npm run deploy` publishes global slash commands with `applications.commands`, not guild/test-only commands. `GUILD_ID` is only used by `npm run clear` to remove old guild/test commands before the global deploy.

If Discord still shows old commands after `npm run clear`, restart Discord with `Cmd+R` or wait a few minutes. Global commands can take up to 1 hour to refresh everywhere in Discord.

## Permissions

The bot needs:

- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History

Invite the bot with both OAuth scopes:

- `bot`
- `applications.commands`

All slash commands are registered as public global commands. If only admins can see or run them, run `npm run refresh` to clear old guild/test command metadata and redeploy globally, then check Discord Server Settings -> Integrations -> Octoson and make sure the commands are not restricted to an admin role.

If no Octoson commands appear in Discord:

- Re-invite the bot with the invite link above.
- Make sure the invite includes both `bot` and `applications.commands`.
- In Server Settings -> Integrations -> Octoson, allow the commands for `@everyone` or the member roles you want.
- In the channel settings, make sure members can use application commands.
- Wait up to 1 hour after `npm run deploy` because global commands are cached by Discord.
