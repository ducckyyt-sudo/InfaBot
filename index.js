const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.get('1424473149138796566');
    const channel = guild.channels.cache.get('1455378516853129309');

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();

  // Play a silent audio file (you need to add one)
  const resource = createAudioResource('silent.mp3');

  player.play(resource);
  connection.subscribe(player);
});

client.login('MTUwMDY1ODgwMDcyMDM1MTM0Mw.GZhY4V.MEH6hsHwKX_o8zepfAAMo9sxG7wisMZiyzRtSQ');