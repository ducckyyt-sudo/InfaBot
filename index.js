// =========================
// DISCORD BOT (RAILWAY SAFE)
// =========================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} = require("discord.js");

let Player;
try {
  Player = require("discord-player").Player;
} catch (e) {
  console.log("⚠️ discord-player not installed yet");
}

// =========================
// CONFIG
// =========================

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;

// =========================
// VC STATE
// =========================

let lockedChannelId = null;
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

const player = Player ? new Player(client) : null;

// =========================
// COMMANDS
// =========================

const commands = [
  { name: "ping", description: "Check bot latency" },

  // MUSIC
  {
    name: "play",
    description: "Play music (YouTube/Spotify/SoundCloud)",
    options: [
      {
        name: "query",
        type: 3,
        description: "Song name or link",
        required: true
      }
    ]
  },
  { name: "skip", description: "Skip song" },
  { name: "pause", description: "Pause music" },
  { name: "resume", description: "Resume music" },
  { name: "stop", description: "Stop music" },
  { name: "queue", description: "Show queue" },
  { name: "loop", description: "Toggle loop" },

  // VC CONTROL
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
  { name: "leave", description: "Leave voice channel" },
  { name: "lockvc", description: "Lock bot to current voice channel" },
  { name: "unlockvc", description: "Unlock voice lock" }
];

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("📦 Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Commands registered.");
  } catch (err) {
    console.error(err);
  }
}

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;

  // =====================
  // PING
  // =====================
  if (interaction.commandName === "ping") {
    return interaction.reply(`Ping: ${client.ws.ping}ms`);
  }

  // =====================
  // JOIN VC
  // =====================
  if (interaction.commandName === "join") {
    const channel = interaction.options.getChannel("channel");

    if (!channel || channel.type !== 2) {
      return interaction.reply("❌ Invalid voice channel.");
    }

    lockedChannelId = channel.id;

    const { joinVoiceChannel } = require("@discordjs/voice");

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    return interaction.reply(`🔊 Joined ${channel.name}`);
  }

  // =====================
  // LEAVE VC
  // =====================
  if (interaction.commandName === "leave") {
    const { getVoiceConnection } = require("@discordjs/voice");

    const conn = getVoiceConnection(interaction.guild.id);
    if (!conn) return interaction.reply("❌ Not in VC");

    conn.destroy();
    connection = null;

    return interaction.reply("👋 Left voice channel");
  }

  // =====================
  // LOCK VC
  // =====================
  if (interaction.commandName === "lockvc") {
    const vc = interaction.member.voice.channel;

    if (!vc) return interaction.reply("❌ Join a voice channel first.");

    lockedChannelId = vc.id;

    return interaction.reply(`🔒 Locked to ${vc.name}`);
  }

  // =====================
  // UNLOCK VC
  // =====================
  if (interaction.commandName === "unlockvc") {
    lockedChannelId = null;
    return interaction.reply("🔓 Voice lock removed");
  }

  // =====================
  // MUSIC GUARD
  // =====================
  if (!player) {
    if (["play","skip","pause","resume","stop","queue","loop"].includes(interaction.commandName)) {
      return interaction.reply("❌ Music system not installed.");
    }
  }

  // =====================
  // PLAY
  // =====================
  if (interaction.commandName === "play") {
    const query = interaction.options.getString("query");
    const channel = interaction.member.voice.channel;

    if (!channel) return interaction.reply("❌ Join a voice channel first.");

    await interaction.deferReply();

    const { track } = await player.play(channel, query);
    return interaction.followUp(`▶️ Playing: ${track.title}`);
  }

  // =====================
  // SKIP
  // =====================
  if (interaction.commandName === "skip") {
    player.nodes.get(guildId)?.node.skip();
    return interaction.reply("⏭ Skipped");
  }

  // =====================
  // PAUSE
  // =====================
  if (interaction.commandName === "pause") {
    player.nodes.get(guildId)?.node.pause();
    return interaction.reply("⏸ Paused");
  }

  // =====================
  // RESUME
  // =====================
  if (interaction.commandName === "resume") {
    player.nodes.get(guildId)?.node.resume();
    return interaction.reply("▶ Resumed");
  }

  // =====================
  // STOP
  // =====================
  if (interaction.commandName === "stop") {
    player.nodes.get(guildId)?.node.stop();
    return interaction.reply("⏹ Stopped");
  }

  // =====================
  // QUEUE
  // =====================
  if (interaction.commandName === "queue") {
    const queue = player.nodes.get(guildId);
    if (!queue?.currentTrack) return interaction.reply("Queue empty");

    return interaction.reply(`🎵 Now: ${queue.currentTrack.title}`);
  }

  // =====================
  // LOOP
  // =====================
  if (interaction.commandName === "loop") {
    const queue = player.nodes.get(guildId);
    if (!queue) return interaction.reply("No queue");

    const mode = queue.repeatMode === 0 ? 1 : 0;
    queue.setRepeatMode(mode);

    return interaction.reply(mode ? "🔁 Loop ON" : "➡ Loop OFF");
  }
});

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

// =========================
// LOGIN
// =========================

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN");

client.login(TOKEN);
