// =========================
// DISCORD BOT (FIXED AUDIO ENGINE)
// =========================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} = require("discord.js");

const { Player, QueryType } = require("discord-player");
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
// PLAYER
// =========================

const player = new Player(client);

// 🔥 FIX: Proper extractor loading (THIS WAS MISSING)
(async () => {
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("🎧 Extractors loaded successfully");
  } catch (err) {
    console.log("⚠️ Extractors failed to load:", err);
  }
})();

// =========================
// STATE
// =========================

let lockedChannelId = null;

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
  { name: "loop", description: "Toggle loop" },

  { name: "join", description: "Join your voice channel" },
  { name: "leave", description: "Leave voice channel" },
  { name: "lockvc", description: "Lock bot to current VC" },
  { name: "unlockvc", description: "Unlock VC lock" }
];

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands registered");
}

// =========================
// VOICE
// =========================

function joinVC(channel, guild) {
  return joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });
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
  // JOIN
  // =====================
  if (interaction.commandName === "join") {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply("❌ Join a VC first.");

    lockedChannelId = channel.id;
    joinVC(channel, interaction.guild);

    return interaction.reply(`🔊 Joined ${channel.name}`);
  }

  // =====================
  // LEAVE
  // =====================
  if (interaction.commandName === "leave") {
    const conn = getVoiceConnection(interaction.guild.id);
    if (!conn) return interaction.reply("❌ Not in VC.");

    conn.destroy();
    lockedChannelId = null;

    return interaction.reply("👋 Left VC");
  }

  // =====================
  // LOCK
  // =====================
  if (interaction.commandName === "lockvc") {
    const vc = interaction.member.voice.channel;
    if (!vc) return interaction.reply("❌ Join a VC first.");

    lockedChannelId = vc.id;
    return interaction.reply(`🔒 Locked to ${vc.name}`);
  }

  // =====================
  // UNLOCK
  // =====================
  if (interaction.commandName === "unlockvc") {
    lockedChannelId = null;
    return interaction.reply("🔓 VC unlocked");
  }

  // =====================
  // PLAY (FIXED SAFETY)
  // =====================
  if (interaction.commandName === "play") {
    let query = interaction.options.getString("query");
    const channel = interaction.member.voice.channel;

    if (!channel) return interaction.reply("❌ Join a voice channel first.");

    // prevent Spotify crash
    if (query.includes("spotify.com")) {
      query = "song " + query;
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
      return interaction.followUp("❌ Failed to play audio.");
    }
  }

  // =====================
  // SKIP / PAUSE / RESUME / STOP / QUEUE / LOOP
  // =====================

  if (interaction.commandName === "skip") {
    player.nodes.get(guildId)?.node.skip();
    return interaction.reply("⏭ Skipped");
  }

  if (interaction.commandName === "pause") {
    player.nodes.get(guildId)?.node.pause();
    return interaction.reply("⏸ Paused");
  }

  if (interaction.commandName === "resume") {
    player.nodes.get(guildId)?.node.resume();
    return interaction.reply("▶ Resumed");
  }

  if (interaction.commandName === "stop") {
    player.nodes.get(guildId)?.node.stop();
    return interaction.reply("⏹ Stopped");
  }

  if (interaction.commandName === "queue") {
    const queue = player.nodes.get(guildId);
    if (!queue?.currentTrack) return interaction.reply("Queue empty.");

    return interaction.reply(`🎵 Now playing: ${queue.currentTrack.title}`);
  }

  if (interaction.commandName === "loop") {
    const queue = player.nodes.get(guildId);
    if (!queue) return interaction.reply("No queue.");

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
