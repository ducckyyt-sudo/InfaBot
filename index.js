// =========================
// DISCORD BOT (RAILWAY READY + MUSIC)
// =========================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} = require("discord.js");

const { Player } = require("discord-player");

// =========================
// CONFIG
// =========================

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// MUSIC PLAYER
const player = new Player(client);

// =========================
// COMMANDS (UPDATED)
// =========================

const commands = [
  {
    name: "play",
    description: "Play music from YouTube / Spotify / SoundCloud",
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
  {
    name: "volume",
    description: "Set volume",
    options: [
      {
        name: "amount",
        type: 4,
        required: true
      }
    ]
  },
  { name: "loop", description: "Toggle loop" },
  { name: "ping", description: "Check bot latency" }
];

// =========================
// REGISTER COMMANDS (FIXED)
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  console.log("🧹 Clearing old commands...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [] }
  );

  console.log("📦 Registering new commands...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands updated.");
}

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;

  // 🎵 PLAY
  if (interaction.commandName === "play") {
    const query = interaction.options.getString("query");
    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply("❌ Join a voice channel first.");
    }

    await interaction.deferReply();

    try {
      const { track } = await player.play(channel, query, {
        nodeOptions: {
          metadata: interaction
        }
      });

      return interaction.followUp(`▶️ Playing: **${track.title}**`);
    } catch (err) {
      console.error(err);
      return interaction.followUp("❌ Could not play that.");
    }
  }

  // ⏭ SKIP
  if (interaction.commandName === "skip") {
    player.nodes.get(guildId)?.node.skip();
    return interaction.reply("⏭ Skipped");
  }

  // ⏸ PAUSE
  if (interaction.commandName === "pause") {
    player.nodes.get(guildId)?.node.pause();
    return interaction.reply("⏸ Paused");
  }

  // ▶ RESUME
  if (interaction.commandName === "resume") {
    player.nodes.get(guildId)?.node.resume();
    return interaction.reply("▶ Resumed");
  }

  // ⏹ STOP
  if (interaction.commandName === "stop") {
    player.nodes.get(guildId)?.node.stop();
    return interaction.reply("⏹ Stopped");
  }

  // 📜 QUEUE
  if (interaction.commandName === "queue") {
    const queue = player.nodes.get(guildId);
    if (!queue || !queue.currentTrack) {
      return interaction.reply("Queue is empty.");
    }

    return interaction.reply(`🎵 Now playing: ${queue.currentTrack.title}`);
  }

  // 🔊 VOLUME
  if (interaction.commandName === "volume") {
    const vol = interaction.options.getInteger("amount");
    const queue = player.nodes.get(guildId);

    if (!queue) return interaction.reply("No active queue.");

    queue.node.setVolume(vol);
    return interaction.reply(`🔊 Volume: ${vol}`);
  }

  // 🔁 LOOP
  if (interaction.commandName === "loop") {
    const queue = player.nodes.get(guildId);

    if (!queue) return interaction.reply("No active queue.");

    const mode = queue.repeatMode === 0 ? 1 : 0;
    queue.setRepeatMode(mode);

    return interaction.reply(mode ? "🔁 Loop ON" : "➡ Loop OFF");
  }

  // 🏓 PING
  if (interaction.commandName === "ping") {
    return interaction.reply(`Ping: ${client.ws.ping}ms`);
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
// SAFETY
// =========================

if (!process.env.DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN");
if (!process.env.CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!process.env.GUILD_ID) throw new Error("Missing GUILD_ID");

client.login(process.env.DISCORD_TOKEN);
