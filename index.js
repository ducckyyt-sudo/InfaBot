// =========================
// DISCORD BOT (RAILWAY READY)
// =========================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ChannelType
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

// =========================
// CONFIG
// =========================

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

let targetChannelId = null;
let stayLocked = true;
let connection = null;

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = createAudioPlayer();

// =========================
// PRESENCE
// =========================

function updateBotPresence() {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Competing in Xess",
        type: 0
      }
    ]
  });
}

// =========================
// COMMANDS
// =========================

const commands = [
  {
    name: "join",
    description: "Join a voice channel",
    options: [
      {
        name: "channel",
        type: 7,
        description: "Voice channel",
        required: true,
        channel_types: [2]
      }
    ]
  },
  { name: "leave", description: "Leave VC" },
  { name: "ping", description: "Check latency" },
  { name: "status", description: "Bot status" }
];

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  if (!CLIENT_ID || !GUILD_ID) {
    console.log("❌ Missing CLIENT_ID or GUILD_ID");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Commands registered.");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

// =========================
// VOICE CONNECTION
// =========================

function joinChannel(channelId) {
  console.log("Trying to join:", channelId);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log("❌ Guild not found");
    return;
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    console.log("❌ Invalid voice channel");
    return;
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  targetChannelId = channelId;

  connection.on("stateChange", (oldState, newState) => {
    console.log(`Connection: ${oldState.status} -> ${newState.status}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Signalling, 5000);
    } catch {
      console.log("Reconnecting...");
      if (stayLocked && targetChannelId) {
        setTimeout(() => joinChannel(targetChannelId), 3000);
      }
    }
  });
}

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "join") {
    const channel = interaction.options.getChannel("channel");

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({ content: "Not a voice channel.", ephemeral: true });
    }

    joinChannel(channel.id);
    return interaction.reply(`Joined ${channel.name}`);
  }

  if (commandName === "leave") {
    stayLocked = false;

    if (connection) {
      connection.destroy();
      connection = null;
    }

    return interaction.reply("Left voice channel.");
  }

  if (commandName === "ping") {
    return interaction.reply(`Ping: ${client.ws.ping}ms`);
  }

  if (commandName === "status") {
    return interaction.reply(
      `VC: ${targetChannelId ? "Connected" : "Not connected"} | Lock: ${stayLocked}`
    );
  }
});

// =========================
// READY EVENT
// =========================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  updateBotPresence();

  await registerCommands();

  if (targetChannelId) joinChannel(targetChannelId);
});

// =========================
// LOGIN SAFETY
// =========================

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in environment variables");
}

if (!process.env.CLIENT_ID) {
  throw new Error("Missing CLIENT_ID in environment variables");
}

if (!process.env.GUILD_ID) {
  throw new Error("Missing GUILD_ID in environment variables");
}

client.login(process.env.DISCORD_TOKEN);

// =========================
// HEARTBEAT
// =========================

setInterval(() => {
  console.log("Bot alive | Ping:", client.ws.ping);
}, 300000);
