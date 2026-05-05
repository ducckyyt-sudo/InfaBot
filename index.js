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

// =====================
// ENV
// =====================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =====================
// PLAYER
// =====================

const player = new Player(client);

// ✅ FIXED extractor init (THIS is what you were missing)
(async () => {
  try {
    await player.extractors.register(DefaultExtractors);
    console.log("🎧 Extractors loaded");
  } catch (e) {
    console.log("❌ Extractor error:", e);
  }
})();

// =====================
// STATE
// =====================

let lockedVC = null;

// =====================
// COMMANDS
// =====================

const commands = [
  { name: "ping", description: "Bot latency" },

  {
    name: "play",
    description: "Play music",
    options: [
      {
        name: "query",
        type: 3,
        description: "Song or link",
        required: true
      }
    ]
  },

  { name: "skip", description: "Skip song" },
  { name: "pause", description: "Pause music" },
  { name: "resume", description: "Resume music" },
  { name: "stop", description: "Stop music" },

  { name: "join", description: "Join VC" },
  { name: "leave", description: "Leave VC" },

  { name: "lock", description: "Lock bot to VC" },
  { name: "unlock", description: "Unlock VC lock" }
];

// =====================
// REGISTER COMMANDS
// =====================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands registered");
}

// =====================
// VOICE HELPERS
// =====================

function joinVC(channel, guild) {
  return joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });
}

// =====================
// INTERACTIONS
// =====================

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
    const vc = interaction.member.voice.channel;
    if (!vc) return interaction.reply("❌ Join a VC first.");

    lockedVC = vc.id;
    joinVC(vc, interaction.guild);

    return interaction.reply(`🔊 Joined ${vc.name}`);
  }

  // =====================
  // LEAVE
  // =====================
  if (interaction.commandName === "leave") {
    const conn = getVoiceConnection(interaction.guild.id);
    if (!conn) return interaction.reply("❌ Not in VC.");

    conn.destroy();
    lockedVC = null;

    return interaction.reply("👋 Left VC");
  }

  // =====================
  // LOCK
  // =====================
  if (interaction.commandName === "lock") {
    const vc = interaction.member.voice.channel;
    if (!vc) return interaction.reply("❌ Join a VC first.");

    lockedVC = vc.id;
    return interaction.reply(`🔒 Locked to ${vc.name}`);
  }

  // =====================
  // UNLOCK
  // =====================
  if (interaction.commandName === "unlock") {
    lockedVC = null;
    return interaction.reply("🔓 Unlocked");
  }

  // =====================
  // PLAY
  // =====================
  if (interaction.commandName === "play") {
    const query = interaction.options.getString("query");
    const vc = interaction.member.voice.channel;

    if (!vc) return interaction.reply("❌ Join a VC first.");

    await interaction.deferReply();

    try {
      const result = await player.play(vc, query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO
      });

      return interaction.followUp(`▶️ Playing: **${result.track.title}**`);
    } catch (err) {
      console.error(err);
      return interaction.followUp("❌ Failed to play track.");
    }
  }

  // =====================
  // BASIC CONTROLS
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
});

// =====================
// READY
// =====================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

// =====================
// LOGIN
// =====================

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN");

client.login(TOKEN);
