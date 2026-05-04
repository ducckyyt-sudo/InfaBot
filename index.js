// =========================
// FULL SINGLE-FILE DISCORD BOT
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
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const { Readable } = require("stream");

// =========================
// CONFIG
// =========================

const GUILD_ID = "1424473149138796566";
const DEFAULT_CHANNEL_ID = "1455378516853129309";
const EMBED_COLOR = 0xA52A2A;

let targetChannelId = DEFAULT_CHANNEL_ID;
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
// STATIC RICH PRESENCE
// =========================

function updateBotPresence() {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Competing in Xess",
        state: "Competitive Mode",
        type: 5,
        assets: {
          large_image: "screenshot_2026-05-03_201359",
          large_text: "EVENING",
          small_image: "screenshot_2026-05-03_201359",
          small_text: "Evening - Level 100"
        },
        timestamps: {
          start: 1507665886 * 1000,
          end: 1507665886 * 1000
        }
      }
    ]
  });
}

// =========================
// SILENT AUDIO STREAM
// =========================

function createSilentResource() {
  const FRAME_SIZE = 3840;
  const silentFrame = Buffer.alloc(FRAME_SIZE);

  const stream = new Readable({
    read() {
      setTimeout(() => this.push(silentFrame), 20);
    }
  });

  return createAudioResource(stream, {
    inputType: StreamType.Raw
  });
}

player.on(AudioPlayerStatus.Idle, () => {
  player.play(createSilentResource());
});

// =========================
// VOICE CONNECTION HANDLING
// =========================

function monitorConnection(conn) {
  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(conn, VoiceConnectionStatus.Signalling, 5000);
    } catch {
      try {
        await entersState(conn, VoiceConnectionStatus.Connecting, 5000);
      } catch {
        conn.destroy();
        joinChannel(targetChannelId);
      }
    }
  });
}

function joinChannel(channelId = targetChannelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  monitorConnection(connection);

  player.play(createSilentResource());
  connection.subscribe(player);
}

// =========================
// SLASH COMMAND DEFINITIONS
// =========================

const commands = [
  {
    name: "join",
    description: "Make the bot join a voice channel",
    options: [
      {
        name: "channel",
        description: "The voice channel to join",
        type: 7,
        channel_types: [2],
        required: true
      }
    ]
  },
  { name: "leave", description: "Disconnect the bot from voice" },
  { name: "stay-on", description: "Enable voice channel lock" },
  { name: "stay-off", description: "Disable voice channel lock" },
  { name: "status", description: "Show the bot's current voice status" },
  { name: "ping", description: "Check bot latency" },
  {
    name: "set-default-vc",
    description: "Set the default voice channel",
    options: [
      {
        name: "channel",
        description: "The new default voice channel",
        type: 7,
        channel_types: [2],
        required: true
      }
    ]
  },
  {
    name: "say",
    description: "Make the bot send a message",
    options: [
      { name: "text", type: 3, description: "The message to send", required: true }
    ]
  },
  {
    name: "embed",
    description: "Send a custom embed",
    options: [
      { name: "title", type: 3, description: "Embed title", required: true },
      { name: "description", type: 3, description: "Embed description", required: true },
      { name: "footer", type: 3, description: "Footer text", required: false },
      { name: "thumbnail", type: 3, description: "Thumbnail URL", required: false },
      { name: "image", type: 3, description: "Image URL", required: false }
    ]
  },
  {
    name: "userinfo",
    description: "Show information about a user",
    options: [
      { name: "user", type: 6, description: "User to inspect", required: false }
    ]
  },
  { name: "serverinfo", description: "Show information about the server" },
  {
    name: "kick",
    description: "Kick a user",
    default_member_permissions: "0x0000000000000002",
    options: [
      { name: "user", type: 6, description: "User to kick", required: true },
      { name: "reason", type: 3, description: "Reason", required: false }
    ]
  },
  {
    name: "ban",
    description: "Ban a user",
    default_member_permissions: "0x0000000000000004",
    options: [
      { name: "user", type: 6, description: "User to ban", required: true },
      { name: "reason", type: 3, description: "Reason", required: false }
    ]
  },
  {
    name: "timeout",
    description: "Timeout a user",
    default_member_permissions: "0x0000000000000002",
    options: [
      { name: "user", type: 6, description: "User to timeout", required: true },
      { name: "duration", type: 4, description: "Minutes", required: true },
      { name: "reason", type: 3, description: "Reason", required: false }
    ]
  }
];
// =========================
// COMMAND HANDLERS
// =========================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  const makeEmbed = (title, description) => ({
    color: EMBED_COLOR,
    title,
    description,
    timestamp: new Date()
  });

  // =========================
  // VOICE COMMANDS
  // =========================

  if (commandName === "join") {
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        content: "❌ That is not a voice channel.",
        ephemeral: true
      });
    }

    targetChannelId = channel.id;
    joinChannel(channel.id);

    return interaction.reply({
      embeds: [makeEmbed("Joined Voice Channel", `Connected to **${channel.name}**`)]
    });
  }

  if (commandName === "leave") {
    stayLocked = false;

    if (connection) {
      connection.destroy();
      connection = null;
    }

    return interaction.reply({
      embeds: [makeEmbed("Disconnected", "Bot has left the voice channel.")]
    });
  }

  if (commandName === "stay-on") {
    stayLocked = true;

    return interaction.reply({
      embeds: [makeEmbed("Voice Lock Enabled", "Bot will stay in the target voice channel.")]
    });
  }

  if (commandName === "stay-off") {
    stayLocked = false;

    return interaction.reply({
      embeds: [makeEmbed("Voice Lock Disabled", "Bot will no longer auto‑rejoin.")]
    });
  }

  if (commandName === "status") {
    const channel = client.channels.cache.get(targetChannelId);

    return interaction.reply({
      embeds: [
        {
          color: EMBED_COLOR,
          title: "Bot Status",
          fields: [
            { name: "Target Channel", value: channel ? channel.name : "Unknown" },
            { name: "Voice Lock", value: stayLocked ? "Enabled" : "Disabled" }
          ],
          timestamp: new Date()
        }
      ]
    });
  }

  // =========================
  // UTILITY COMMANDS
  // =========================

  if (commandName === "ping") {
    return interaction.reply({
      embeds: [
        makeEmbed("Pong!", `Latency: **${client.ws.ping}ms**`)
      ]
    });
  }

  if (commandName === "set-default-vc") {
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        content: "❌ That is not a voice channel.",
        ephemeral: true
      });
    }

    targetChannelId = channel.id;

    return interaction.reply({
      embeds: [
        makeEmbed("Default Voice Channel Updated", `New default: **${channel.name}**`)
      ]
    });
  }

  // =========================
  // SAY COMMAND
  // =========================

  if (commandName === "say") {
    const text = interaction.options.getString("text");

    await interaction.reply({ content: "Message sent.", ephemeral: true });
    return interaction.channel.send({ content: text });
  }

  // =========================
  // EMBED COMMAND
  // =========================

  if (commandName === "embed") {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const footer = interaction.options.getString("footer");
    const thumbnail = interaction.options.getString("thumbnail");
    const image = interaction.options.getString("image");

    const embed = {
      color: EMBED_COLOR,
      title,
      description,
      timestamp: new Date()
    };

    if (footer) embed.footer = { text: footer };
    if (thumbnail) embed.thumbnail = { url: thumbnail };
    if (image) embed.image = { url: image };

    return interaction.reply({ embeds: [embed] });
  }

  // =========================
  // USERINFO
  // =========================

  if (commandName === "userinfo") {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    return interaction.reply({
      embeds: [
        {
          color: EMBED_COLOR,
          title: `User Info — ${user.username}`,
          thumbnail: { url: user.displayAvatarURL() },
          fields: [
            { name: "Tag", value: user.tag },
            { name: "ID", value: user.id },
            { name: "Joined Server", value: member.joinedAt.toLocaleString() },
            { name: "Account Created", value: user.createdAt.toLocaleString() }
          ],
          timestamp: new Date()
        }
      ]
    });
  }

  // =========================
  // SERVERINFO
  // =========================

  if (commandName === "serverinfo") {
    const guild = interaction.guild;

    return interaction.reply({
      embeds: [
        {
          color: EMBED_COLOR,
          title: "Server Info",
          thumbnail: { url: guild.iconURL() },
          fields: [
            { name: "Name", value: guild.name },
            { name: "ID", value: guild.id },
            { name: "Members", value: `${guild.memberCount}` },
            { name: "Created", value: guild.createdAt.toLocaleString() }
          ],
          timestamp: new Date()
        }
      ]
    });
  }

  // =========================
  // MODERATION COMMANDS
  // =========================

  if (commandName === "kick") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = interaction.guild.members.cache.get(user.id);

    if (!member.kickable) {
      return interaction.reply({
        content: "❌ I cannot kick this user.",
        ephemeral: true
      });
    }

    await member.kick(reason);

    return interaction.reply({
      embeds: [
        makeEmbed("User Kicked", `**${user.tag}** was kicked.\nReason: **${reason}**`)
      ]
    });
  }

  if (commandName === "ban") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = interaction.guild.members.cache.get(user.id);

    if (!member.bannable) {
      return interaction.reply({
        content: "❌ I cannot ban this user.",
        ephemeral: true
      });
    }

    await member.ban({ reason });

    return interaction.reply({
      embeds: [
        makeEmbed("User Banned", `**${user.tag}** was banned.\nReason: **${reason}**`)
      ]
    });
  }

  if (commandName === "timeout") {
    const user = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("duration");
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = interaction.guild.members.cache.get(user.id);
    const ms = minutes * 60 * 1000;

    await member.timeout(ms, reason);

    return interaction.reply({
      embeds: [
        {
          color: EMBED_COLOR,
          title: "User Timed Out",
          description: `**${user.tag}** was timed out for **${minutes} minutes**.\nReason: **${reason}**`,
          timestamp: new Date()
        }
      ]
    });
  }
});

// =========================
// READY EVENT
// =========================

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateBotPresence();
  joinChannel();

  await registerCommands(commands);
});

// =========================
// AUTO-REJOIN IF MOVED
// =========================

client.on("voiceStateUpdate", (oldState, newState) => {
  if (newState.member.id !== client.user.id) return;

  const wasInTarget = oldState.channelId === targetChannelId;
  const nowInTarget = newState.channelId === targetChannelId;

  if (stayLocked && wasInTarget && !nowInTarget) {
    setImmediate(() => joinChannel(targetChannelId));
  }
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);

npm install opusscript
