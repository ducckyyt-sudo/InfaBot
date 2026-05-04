const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const { Readable } = require('stream');

const GUILD_ID = '1424473149138796566';
const DEFAULT_CHANNEL_ID = '1455378516853129309';

let targetChannelId = DEFAULT_CHANNEL_ID;
let connection = null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = createAudioPlayer();

/**
 * Proper 20ms-timed silent PCM stream.
 */
function createSilentResource() {
  const FRAME_SIZE = 3840;
  const silentFrame = Buffer.alloc(FRAME_SIZE);

  const stream = new Readable({
    read() {
      setTimeout(() => this.push(silentFrame), 20);
    }
  });

  return createAudioResource(stream, {
    inputType: StreamType.Raw
  });
}

/**
 * Monitor connection and auto-recover from disconnects.
 */
function monitorConnection(conn) {
  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    console.log('Voice connection lost — attempting recovery...');

    try {
      await entersState(conn, VoiceConnectionStatus.Signalling, 5_000);
      console.log('Reconnected via signalling.');
    } catch {
      try {
        await entersState(conn, VoiceConnectionStatus.Connecting, 5_000);
        console.log('Reconnected via connecting.');
      } catch {
        console.log('Reconnection failed — destroying and rejoining.');
        conn.destroy();
        joinChannel(targetChannelId);
      }
    }
  });
}

/**
 * Join a voice channel and keep the connection stable.
 */
function joinChannel(channelId = targetChannelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  monitorConnection(connection);

  player.play(createSilentResource());
  connection.subscribe(player);

  console.log(`Joined voice channel: ${channel.name}`);
}

/**
 * Register slash commands.
 */
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
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: [command] }
    );
    console.log('Registered /switch-vc command.');
  } catch (err) {
    console.error('Failed to register slash command:', err);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  joinChannel();
});

/**
 * Handle /switch-vc
 */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'switch-vc') return;

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;

  if (!isAdmin && !isOwner) {
    return interaction.reply({
      content: '❌ You need **Administrator** permission to use this command.',
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel('channel');

  if (channel.type !== ChannelType.GuildVoice || channel.guildId !== GUILD_ID) {
    return interaction.reply({
      content: '❌ Please select a voice channel from this server.',
      ephemeral: true
    });
  }

  targetChannelId = channel.id;
  console.log(`Target channel updated to: ${channel.name} (${channel.id})`);

  joinChannel(targetChannelId);

  await interaction.reply({
    content: `✅ Bot moved to **${channel.name}** and will stay there.`,
    ephemeral: false
  });
});

/**
 * Rejoin instantly if forcibly moved.
 */
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.member.id !== client.user.id) return;

  const wasInTarget = oldState.channelId === targetChannelId;
  const nowInTarget = newState.channelId === targetChannelId;

  if (wasInTarget && !nowInTarget) {
    console.log('Bot was moved — rejoining target channel...');
    setImmediate(() => joinChannel(targetChannelId));
  }
});

/**
 * Player error logging
 */
player.on('error', err => {
  console.error('Audio player error:', err);
});

client.login(process.env.DISCORD_TOKEN);

