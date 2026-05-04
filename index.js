const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const GUILD_ID = '1424473149138796566';
const DEFAULT_CHANNEL_ID = '1455378516853129309';

// Mutable — updated at runtime via /switch-vc
let targetChannelId = DEFAULT_CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = createAudioPlayer();

// Global connection reference — reused on rejoin so we never start from scratch
let connection = null;

// Re-play silent.mp3 whenever the player becomes idle so the connection stays active
player.on(AudioPlayerStatus.Idle, () => {
  const resource = createAudioResource('silent.mp3');
  player.play(resource);
});

function joinChannel(channelId = targetChannelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const resource = createAudioResource('silent.mp3');
  player.play(resource);
  connection.subscribe(player);

  console.log(`Joined voice channel: ${channel.name}`);
}

// Register the /switch-vc slash command with Discord
async function registerCommands() {
  const command = new SlashCommandBuilder()
    .setName('switch-vc')
    .setDescription('Move the bot to a different voice channel and keep it there')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The voice channel to move the bot into')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON();

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: [command],
    });
    console.log('Registered /switch-vc slash command.');
  } catch (err) {
    console.error('Failed to register slash command:', err);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  joinChannel();
});

// Handle /switch-vc interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'switch-vc') return;

  // Permission check — must be a guild admin or the bot owner
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;

  if (!isAdmin && !isOwner) {
    return interaction.reply({
      content: '❌ You need the **Administrator** permission to use this command.',
      ephemeral: true,
    });
  }

  const channel = interaction.options.getChannel('channel');

  // Sanity-check: must be a voice channel in the configured guild
  if (channel.type !== ChannelType.GuildVoice || channel.guildId !== GUILD_ID) {
    return interaction.reply({
      content: '❌ Please select a voice channel from this server.',
      ephemeral: true,
    });
  }

  targetChannelId = channel.id;
  console.log(`Target channel updated to: ${channel.name} (${channel.id}) by ${interaction.user.tag}`);

  // Move the bot immediately
  joinChannel(targetChannelId);

  await interaction.reply({
    content: `✅ Bot moved to **${channel.name}** and will now stay there.`,
    ephemeral: false,
  });
});

// Rejoin instantly if the bot is moved away from or disconnected from the target channel
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.member.id !== client.user.id) return;

  const wasInTargetChannel = oldState.channelId === targetChannelId;
  const isNowInTargetChannel = newState.channelId === targetChannelId;

  if (wasInTargetChannel && !isNowInTargetChannel) {
    console.log('Bot was moved or disconnected — rejoining target channel...');
    // setImmediate runs before any pending I/O callbacks, keeping the rejoin
    // as close to synchronous as possible and well under 100 ms.
    setImmediate(() => {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      connection = joinVoiceChannel({
        channelId: targetChannelId,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      // Player is already running — just resubscribe the existing instance
      connection.subscribe(player);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
