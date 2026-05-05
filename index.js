const {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} = require("discord.js");

const { Player } = require("discord-player");
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
    description: "Play music (YouTube / Spotify / SoundCloud)",
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
// VOICE JOIN
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
  // PLAY (FIXED v7 PROPER NODE)
  // =====================
  if (interaction.commandName === "play") {
    const query = interaction.options.getString("query");
    const vc = interaction.member.voice.channel;

    if (!vc) return interaction.reply("❌ Join a VC first.");

    await interaction.deferReply();

    try {
      const result = await player.play(vc, query, {
        requestedBy: interaction.user
      });

      return interaction.followUp(`▶️ Playing: **${result.track.title}**`);
    } catch (err) {
      console.error("PLAY ERROR:", err);
      return interaction.followUp("❌ Could not play that track.");
    }
  }

  // =====================
  // SKIP (FIXED)
  // =====================
  if (interaction.commandName === "skip") {
    const queue = player.nodes.get(interaction.guild);
    if (!queue) return interaction.reply("❌ Nothing playing.");

    queue.node.skip();
    return interaction.reply("⏭ Skipped");
  }

  // =====================
  // PAUSE
  // =====================
  if (interaction.commandName === "pause") {
    const queue = player.nodes.get(interaction.guild);
    if (!queue) return interaction.reply("❌ Nothing playing.");

    queue.node.pause();
    return interaction.reply("⏸ Paused");
  }

  // =====================
  // RESUME
  // =====================
  if (interaction.commandName === "resume") {
    const queue = player.nodes.get(interaction.guild);
    if (!queue) return interaction.reply("❌ Nothing playing.");

    queue.node.resume();
    return interaction.reply("▶ Resumed");
  }

  // =====================
  // STOP
  // =====================
  if (interaction.commandName === "stop") {
    const queue = player.nodes.get(interaction.guild);
    if (!queue) return interaction.reply("❌ Nothing playing.");

    queue.node.stop();
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
