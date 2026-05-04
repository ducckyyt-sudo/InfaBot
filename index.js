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

const GUILD_ID = process.env.GUILD_ID || "YOUR_GUILD_ID";
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
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );

    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
}

// =========================
// VOICE CONNECTION
// =========================

function joinChannel(channelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  targetChannelId = channelId;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Signalling, 5000);
    } catch {
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
// READY EVENT (RAILWAY SAFE)
// =========================

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateBotPresence();

  setTimeout(async () => {
    await registerCommands();
    if (targetChannelId) joinChannel(targetChannelId);
  }, 2000);
});

// =========================
// LOGIN SAFETY
// =========================

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in environment variables");
}

client.login(process.env.DISCORD_TOKEN);

// =========================
// HEARTBEAT (DEBUG)
// =========================

setInterval(() => {
  console.log("Bot alive | Ping:", client.ws.ping);
}, 300000);
