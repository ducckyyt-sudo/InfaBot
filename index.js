const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const GUILD_ID = '1424473149138796566';
const CHANNEL_ID = '1455378516853129309';

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

function joinChannel() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNEL_ID);
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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  joinChannel();
});

// Rejoin instantly if the bot is moved away from or disconnected from the target channel
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.member.id !== client.user.id) return;

  const wasInTargetChannel = oldState.channelId === CHANNEL_ID;
  const isNowInTargetChannel = newState.channelId === CHANNEL_ID;

  if (wasInTargetChannel && !isNowInTargetChannel) {
    console.log('Bot was moved or disconnected — rejoining target channel...');
    // setImmediate runs before any pending I/O callbacks, keeping the rejoin
    // as close to synchronous as possible and well under 100 ms.
    setImmediate(() => {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      connection = joinVoiceChannel({
        channelId: CHANNEL_ID,
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
