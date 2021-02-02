const Discord = require("discord.js");
const logger = require("./logger")("bot");
const config = require("./config");
const messages = require("./messages");
const commands = require("./commands");
const { runDaily, runInterval } = require("./utils");
const events = require("./queries/events");
const battles = require("./queries/battles");
const dailyRanking = require("./queries/dailyRanking");
const guilds = require("./queries/guilds");
const { hasSubscription } = require("./subscriptions");
const database = require("./database");
const queue = require("./queue");

const COMMAND_PREFIX = "!";

const client = new Discord.Client({
  autoReconnect: true,
});
client.commands = commands;

client.on("shardReady", async id => {
  client.shardId = id;
  logger.info(`[#${id}] Shard ready as ${client.user.tag}. Guild count: ${client.guilds.cache.size}`);

  queue.subscribe(events.subscribe, exports);
  queue.subscribe(battles.subscribe, exports);

  runDaily(guilds.showRanking, "Show Monthly Ranking", exports);
  runDaily(dailyRanking.scanDaily, "Show PvP Ranking (daily)", exports, 0, 0);
  runInterval(dailyRanking.scan, "Show PvP Ranking", exports, 3600000);
});

client.on("shardDisconnect", async (ev, id) => {
  logger.info(`[#${id}] Disconnected from Discord: [${ev.code}] ${ev.reason}`);

  queue.unsubscribeAll();
});

client.on("shardReconnecting", async id => {
  logger.info(`[#${id}] Trying to reconnect to Discord.`);
});

client.on("error", async e => {
  logger.info(`Discord error: ${e}.`);
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content || !message.content.startsWith(COMMAND_PREFIX)) return;
  if (!message.member) return;
  // For now, bot only accepts commands from server admins
  if (!message.member.hasPermission("ADMINISTRATOR")) return;

  // This is needed to inherit configs to guild object
  const guild = message.guild;
  guild.config = await config.getConfig(guild);
  if (!hasSubscription(guild.config)) return;

  const args = message.content
    .slice(COMMAND_PREFIX.length)
    .trim()
    .split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (commands[cmd]) {
    commands[cmd].run(client, guild, message, args);
  }
});

client.on("guildCreate", async guild => {
  logger.info(`Joined guild "${guild.name}". Creating default settings.`);
  guild.config = await config.getConfig(guild);
  guild.config.channel = exports.getDefaultChannel(guild).id;
  config.setConfig(guild);
  const l = messages.getI18n(guild);
  exports.sendGuildMessage(guild, l.__("JOIN"));
});

client.on("guildDelete", guild => {
  logger.info(`Left guild "${guild.name}". Deleting settings.`);
  config.deleteConfig(guild);
});

exports.getDefaultChannel = guild => {
  // Get "original" default channel
  if (guild.channels.cache.has(guild.id)) return guild.channels.cache.get(guild.id);

  // Check for a "general" channel, which is often default chat
  const generalChannel = guild.channels.cache.find(channel => channel.name === "general");
  if (generalChannel) return generalChannel;
  // Now we get into the heavy stuff: first channel in order where the bot can speak
  // hold on to your hats!
  return guild.channels.cache
    .filter(c => c.type === "text" && c.permissionsFor(guild.client.user).has("SEND_MESSAGES"))
    .sort((a, b) => a.position - b.position)
    .first();
};

const msgErrors = {};
exports.sendGuildMessage = async (guild, message, category = "general") => {
  if (!guild.config) guild.config = await config.getConfig(guild);
  if (!guild.config.categories) guild.config.categories = {};
  if (guild.config.categories[category] === false) return;

  let channelId = guild.config.channel[category];
  if (!channelId) channelId = guild.config.channel.general;
  // Old structure backport
  if (typeof guild.config.channel === "string") channelId = guild.config.channel;

  const l = messages.getI18n(guild);
  let channel = client.channels.cache.find(c => c.id === channelId) || exports.getDefaultChannel(guild);
  if (!channel) return;
  try {
    await channel.send(message);
    msgErrors[guild.id] = 0;
  } catch (e) {
    logger.error(`Unable to send message to guild ${guild.name}/${channel.name}: ${e}`);

    if (
      e.code === Discord.Constants.APIErrors.UNKNOWN_CHANNEL ||
      e.code === Discord.Constants.APIErrors.MISSING_ACCESS ||
      e.code === Discord.Constants.APIErrors.MISSING_PERMISSIONS
    ) {
      if (!msgErrors[guild.id]) msgErrors[guild.id] = 0;
      msgErrors[guild.id]++;
      // If more than 50 msg errors occur in succession, bot will leave and warn owner
      if (msgErrors[guild.id] > 50) {
        logger.warn(`Leaving guild ${guild.name} due to excessive message errors. Warning owner.`);
        await guild.owner.send(l.__("LEAVE", { guild: guild.name }));
        await guild.leave();
        msgErrors[guild.id] = 0;
      }
    }
  }
};

exports.client = client;

(async () => {
  database.connect();
  await queue.connect();
  await client.login();
})();
