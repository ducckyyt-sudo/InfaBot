// =========================
// DISCORD BOT (FIXED AUDIO ENGINE)
// =========================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} = require("discord.js");

const {
  Player,
  QueryType
} = require("discord-player");

const { DefaultExtractors } = require("@discord-player/extractor");

const {
  joinVoiceChannel,
  getVoiceConnection
} = require("@discordjs/voice");

// =========================
// CONFIG
// =========================

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =========================
// PLAYER (FIXED)
// =========================

const player = new Player(client);

// 🔥 FIX: proper extractor system (THIS FIXES YOUR ERROR)
player.extractors.loadMulti(DefaultExtractors);

// =========================
// COMMANDS
// =========================

const commands = [
  { name: "ping", description: "Check bot latency" },

  {
    name: "play",
    description: "Play music",
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
  { name: "loop", description: "Toggle loop" }
];

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log("📦 Registering commands...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands registered.");
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
  // PLAY (FIXED AUDIO PIPELINE)
  // =====================
  if (interaction.commandName === "play") {
    const query = interaction.options.getString("query");
    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply("❌ Join a voice channel first.");
    }

    await interaction.deferReply();

    try {
      const result = await player.play(channel, query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO
      });

      return interaction.followUp(`▶️ Playing: **${result.track.title}**`);
    } catch (err) {
      console.error("PLAY ERROR:", err);
      return interaction.followUp("❌ Failed to play audio (check Railway logs).");
    }
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

    if (!queue?.currentTrack) {
      return interaction.reply("Queue is empty.");
    }

    return interaction.reply(`🎵 Now playing: ${queue.currentTrack.title}`);
  }

  // =====================
  // LOOP
  // =====================
  if (interaction.commandName === "loop") {
    const queue = player.nodes.get(guildId);

    if (!queue) return interaction.reply("No queue.");

    const mode = queue.repeatMode === 0 ? 1 : 0;
    queue.setRepeatMode(mode);

    return interaction.reply(mode ? "🔁 Loop ON" : "➡ Loop OFF");
  }
});

// =========================
// READY EVENT
// =========================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await registerCommands();
});

// =========================
// LOGIN SAFETY
// =========================

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN");

client.login(TOKEN);
