require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bloom Bot is online.");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, SlashCommandBuilder, REST, Routes
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const BUYER_CATEGORY_ID = "1524567770002489584";
const MM_CATEGORY_ID = "1524570656291688652";

const NEW_MM_ROLE_ID = "1523782888296939660";
const MM_ROLE_ID = "1516085004801802260";
const TRUSTED_MM_ROLE_ID = "1523783007842992238";
const SELLER_ROLE_ID = "1516085109378252810";

const BUYER_VOUCH_CHANNEL_ID = "1516081257547825232";
const MM_VOUCH_CHANNEL_ID = "1523533160506327090";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const priceList = {
  seeds: {
    "20x Mega Seed": 1,
    "3x Ghost Pepper": 1,
    "3x Hypno Bloom": 1,
    "3x Moon Bloom": 1,
    "4x Dragon Breath": 2,
    "Carrots": 0.1,
    "Bamboo": 0.1,
    "20x Rainbow Seed": 1,
    "40x Gold Seed": 1
  },
  gear: {
    "8x Super Watering Can": 1,
    "8x Super Sprinkler": 1
  },
  pets: {
    "Black Dragon": 69,
    "Raccoon": 3,
    "3x Dragonfly": 1,
    "3x Unicorn": 1,
    "Ice Serpent": 55,
    "3x Bear": 1,
    "3x Bald Eagle": 1,
    "Butterfly": 2,
    "Bee": 0.1,
    "Big Bunny": 0.5,
    "Rainbow Bunny": 0.5
  }
};

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function isBuyerTicket(channel) {
  return channel?.parentId === BUYER_CATEGORY_ID;
}

function isMMTicket(channel) {
  return channel?.parentId === MM_CATEGORY_ID;
}

function cleanAmount(raw) {
  const n = Number(raw);
  if (isNaN(n) || n <= 0) return 1;
  return n;
}

function premiumEmbed(title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Bloom Bot • Premium Assistant" });
}

async function addUserToTicket(channel, userId) {
  try {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });
    return true;
  } catch (err) {
    console.log("Add user failed:", err.message);
    return false;
  }
}

function extractMentionId(text) {
  const match = text.match(/<@!?(\d+)>/);
  return match ? match[1] : null;
}

async function resolveUserFromText(guild, text) {
  const mentionId = extractMentionId(text);
  if (mentionId) {
    try {
      return await guild.members.fetch(mentionId);
    } catch {
      return null;
    }
  }

  const raw = text.replace("@", "").trim().toLowerCase();

  try {
    const members = await guild.members.fetch();
    return members.find(m =>
      m.user.username.toLowerCase() === raw ||
      m.displayName.toLowerCase() === raw ||
      `${m.user.username.toLowerCase()}#${m.user.discriminator}` === raw
    ) || null;
  } catch {
    return null;
  }
}

function buyerPanel() {
  const embed = premiumEmbed(
    "🛒 Buyer Assistant",
    "Welcome! Click **Start Order** and Bloom Bot will help you place your order.\n\n• Auto price calculator\n• Custom item option\n• Seller claim system\n• Required vouch after delivery"
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buyer_start")
      .setLabel("Start Order")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function mmPanel() {
  const embed = premiumEmbed(
    "🛡️ Middleman Assistant",
    "Welcome! Click **Start MM Request** and Bloom Bot will organize the trade.\n\n• Auto adds mentioned trader to the ticket\n• Pings correct MM role\n• Clean trade summary\n• Required vouch after completion",
    0x5865f2
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_start")
      .setLabel("Start MM Request")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function buyerCategoryMenu(interaction) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("buyer_category")
    .setPlaceholder("Choose what you want to buy")
    .addOptions(
      { label: "Seeds", value: "seeds", emoji: "🌱" },
      { label: "Gear", value: "gear", emoji: "🛠️" },
      { label: "Pets", value: "pets", emoji: "🐾" },
      { label: "Other", value: "other", emoji: "❓" }
    );

  return interaction.reply({
    content: "🛒 Choose a category:",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function itemMenu(interaction, category) {
  if (category === "other") return otherItemModal(interaction, "other");

  const options = Object.entries(priceList[category]).map(([name, price]) => ({
    label: name,
    value: name,
    description: `Price: ${money(price)}`
  }));

  options.push({
    label: "Other",
    value: "Other",
    description: "Type your own item, seller will price it"
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`buyer_item_${category}`)
    .setPlaceholder("Choose an item")
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content: "📦 Choose the item:",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function otherItemModal(interaction, category) {
  const modal = new ModalBuilder()
    .setCustomId(`buyer_other_${category}`)
    .setTitle("Custom Order");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("item")
        .setLabel("What item do you want?")
        .setPlaceholder("Example: Rainbow Butterfly")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("How many?")
        .setPlaceholder("Example: 1, 5, 20")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("payment")
        .setLabel("Payment method")
        .setPlaceholder("PayPal / Gift Card / Crypto / Other")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("Extra notes")
        .setPlaceholder("Optional")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    )
  );

  return interaction.showModal(modal);
}

async function amountModal(interaction, category, itemName) {
  const encoded = Buffer.from(itemName).toString("base64");

  const modal = new ModalBuilder()
    .setCustomId(`buyer_amount_${category}_${encoded}`)
    .setTitle("Order Details");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("How many?")
        .setPlaceholder("Example: 1, 5, 20")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("payment")
        .setLabel("Payment method")
        .setPlaceholder("PayPal / Gift Card / Crypto / Other")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("Extra notes")
        .setPlaceholder("Optional")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    )
  );

  return interaction.showModal(modal);
}

function orderButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("order_claim").setLabel("Claim").setEmoji("🙋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("order_paid").setLabel("Paid").setEmoji("💳").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("order_done").setLabel("Delivered").setEmoji("📦").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("order_cancel").setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Danger)
  );
}

async function sendOrderSummary(interaction, data) {
  const orderId = Math.floor(100000 + Math.random() * 900000);

  let priceText = "Seller will provide price.";
  if (data.price !== null) {
    const total = data.price * data.amount;
    priceText = `${money(data.price)} each\n**Total:** ${money(total)}`;
  }

  const embed = premiumEmbed(`🛒 Order #${orderId}`, "A new order has been created.")
    .addFields(
      { name: "👤 Buyer", value: `${interaction.user}\n${interaction.user.username}`, inline: false },
      { name: "📦 Category", value: data.category, inline: true },
      { name: "🛍️ Item", value: data.item, inline: true },
      { name: "🔢 Amount", value: String(data.amount), inline: true },
      { name: "💰 Price", value: priceText, inline: false },
      { name: "💳 Payment", value: data.payment, inline: false },
      { name: "📝 Notes", value: data.notes || "None", inline: false },
      { name: "⏳ Status", value: "Waiting for Seller", inline: false }
    );

  await interaction.channel.send({
    content: `<@&${SELLER_ROLE_ID}> New order waiting!`,
    embeds: [embed],
    components: [orderButtons()]
  });

  return interaction.reply({
    content: "✅ Your order was sent to the sellers.",
    ephemeral: true
  });
}

function vouchButton(type) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vouch_${type}`)
      .setLabel("Write Required Vouch")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Success)
  );
}

async function vouchModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`vouch_modal_${type}`)
    .setTitle("Required Vouch");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rating")
        .setLabel("Rating 1-5")
        .setPlaceholder("Example: 5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("vouch")
        .setLabel("Write your vouch")
        .setPlaceholder("Example: Fast and trusted service!")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

async function sendVouch(interaction, type) {
  const rating = interaction.fields.getTextInputValue("rating");
  const text = interaction.fields.getTextInputValue("vouch");

  const channelId = type === "buyer" ? BUYER_VOUCH_CHANNEL_ID : MM_VOUCH_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId);

  const embed = premiumEmbed(
    type === "buyer" ? "⭐ New Buyer Vouch" : "🛡️ New MM Vouch",
    text,
    type === "buyer" ? 0x2ecc71 : 0x5865f2
  ).addFields(
    { name: "👤 User", value: `${interaction.user}\n${interaction.user.username}`, inline: true },
    { name: "⭐ Rating", value: `${rating}/5`, inline: true },
    { name: "🎫 Ticket", value: `${interaction.channel}`, inline: false }
  );

  await channel.send({ embeds: [embed] });

  return interaction.reply({
    content: `✅ Vouch sent to <#${channelId}>. Thank you!`,
    ephemeral: true
  });
}

function mmSizeMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("mm_size")
    .setPlaceholder("Choose trade size")
    .addOptions(
      { label: "Small Trade", value: "small", emoji: "🔹", description: "Pings New MM" },
      { label: "Normal Trade", value: "normal", emoji: "🔸", description: "Pings MM" },
      { label: "Huge Trade", value: "huge", emoji: "🔶", description: "Pings Trusted MM" }
    );

  return new ActionRowBuilder().addComponents(menu);
}

async function mmModal(interaction, size) {
  const modal = new ModalBuilder()
    .setCustomId(`mm_modal_${size}`)
    .setTitle("Middleman Request");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("trader2")
        .setLabel("Other trader @mention or username")
        .setPlaceholder("@tradername")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives1")
        .setLabel("What are YOU giving?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives2")
        .setLabel("What is the OTHER trader giving?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

function mmButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mm_claim").setLabel("Claim MM").setEmoji("🛡️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("mm_confirmed").setLabel("Both Confirmed").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("mm_done").setLabel("Complete").setEmoji("📦").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("mm_cancel").setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Danger)
  );
}

async function sendMMSummary(interaction, data) {
  let roleId = NEW_MM_ROLE_ID;
  let sizeText = "Small Trade";
  let statusText = "Waiting for New MM";

  if (data.size === "normal") {
    roleId = MM_ROLE_ID;
    sizeText = "Normal Trade";
    statusText = "Waiting for MM";
  }

  if (data.size === "huge") {
    roleId = TRUSTED_MM_ROLE_ID;
    sizeText = "Huge Trade";
    statusText = "Waiting for Trusted MM";
  }

  const embed = premiumEmbed("🛡️ Middleman Request", "A new MM request has been created.", 0x5865f2)
    .addFields(
      { name: "👤 Trader 1", value: `${interaction.user}\n${interaction.user.username}`, inline: true },
      { name: "👤 Trader 2", value: data.trader2Text, inline: true },
      { name: "📦 Trader 1 Gives", value: data.gives1, inline: false },
      { name: "📦 Trader 2 Gives", value: data.gives2, inline: false },
      { name: "📊 Trade Size", value: sizeText, inline: true },
      { name: "⏳ Status", value: statusText, inline: true }
    );

  await interaction.channel.send({
    content: `<@&${roleId}> New MM request!`,
    embeds: [embed],
    components: [mmButtons()]
  });

  return interaction.reply({
    content: "✅ MM request sent.",
    ephemeral: true
  });
}

function onlyStaff(member) {
  return member.roles.cache.has(SELLER_ROLE_ID) ||
    member.roles.cache.has(NEW_MM_ROLE_ID) ||
    member.roles.cache.has(MM_ROLE_ID) ||
    member.roles.cache.has(TRUSTED_MM_ROLE_ID);
}

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Send ticket assistant panel"),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot ping"),
  new SlashCommandBuilder().setName("help").setDescription("Show commands"),
  new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin"),
  new SlashCommandBuilder().setName("8ball").setDescription("Ask the magic 8ball")
    .addStringOption(o => o.setName("question").setDescription("Your question").setRequired(true)),
  new SlashCommandBuilder().setName("rate").setDescription("Rate something")
    .addStringOption(o => o.setName("thing").setDescription("Thing to rate").setRequired(true)),
  new SlashCommandBuilder().setName("roast").setDescription("Funny roast")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("say").setDescription("Make the bot say something")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true)),
  new SlashCommandBuilder().setName("embed").setDescription("Make a clean embed")
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true)),
  new SlashCommandBuilder().setName("avatar").setDescription("Show avatar")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show user info")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server info"),
  new SlashCommandBuilder().setName("addtoticket").setDescription("Add a user to this ticket")
    .addUserOption(o => o.setName("user").setDescription("User to add").setRequired(true)),
  new SlashCommandBuilder().setName("close").setDescription("Close/delete this ticket")
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered.");
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("channelCreate", async channel => {
  setTimeout(async () => {
    try {
      if (!channel || !channel.isTextBased()) return;
      if (isBuyerTicket(channel)) await channel.send(buyerPanel());
      if (isMMTicket(channel)) await channel.send(mmPanel());
    } catch (err) {
      console.log("Auto panel error:", err.message);
    }
  }, 2500);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      if (cmd === "ping") {
        return interaction.reply({ content: `🏓 Pong! ${client.ws.ping}ms`, ephemeral: true });
      }

      if (cmd === "help") {
        const embed = premiumEmbed("🌱 Bloom Bot Commands", "Premium server assistant commands.")
          .addFields(
            { name: "🎫 Ticket", value: "`/panel` `/addtoticket` `/close`" },
            { name: "🛒 Buyer", value: "Buyer Assistant auto-posts in buyer tickets." },
            { name: "🛡️ MM", value: "MM Assistant auto-posts in MM tickets." },
            { name: "🎉 Fun", value: "`/coinflip` `/8ball` `/rate` `/roast`" },
            { name: "🧰 Useful", value: "`/avatar` `/userinfo` `/serverinfo` `/say` `/embed`" }
          );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (cmd === "panel") {
        if (isBuyerTicket(interaction.channel)) return interaction.reply(buyerPanel());
        if (isMMTicket(interaction.channel)) return interaction.reply(mmPanel());
        return interaction.reply({ content: "❌ This only works in ticket categories.", ephemeral: true });
      }

      if (cmd === "coinflip") {
        return interaction.reply(`🪙 ${Math.random() < 0.5 ? "Heads" : "Tails"}`);
      }

      if (cmd === "8ball") {
        const answers = ["Yes.", "No.", "Maybe.", "100%.", "Not today.", "Ask again later.", "Looks good.", "Bad idea."];
        return interaction.reply(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
      }

      if (cmd === "rate") {
        const thing = interaction.options.getString("thing");
        const rating = Math.floor(Math.random() * 101);
        return interaction.reply(`📊 I rate **${thing}** a **${rating}/100**`);
      }

      if (cmd === "roast") {
        const user = interaction.options.getUser("user") || interaction.user;
        const roasts = [
          "Your WiFi has more stability than your trades.",
          "You joined the ticket and even the bot got confused.",
          "Bro is moving like a loading screen.",
          "Your luck is lower than out-of-stock items."
        ];
        return interaction.reply(`${user} ${roasts[Math.floor(Math.random() * roasts.length)]}`);
      }

      if (cmd === "say") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        const msg = interaction.options.getString("message");
        await interaction.reply({ content: "✅ Sent.", ephemeral: true });
        return interaction.channel.send(msg);
      }

      if (cmd === "embed") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        const title = interaction.options.getString("title");
        const message = interaction.options.getString("message");
        return interaction.reply({ embeds: [premiumEmbed(title, message)] });
      }

      if (cmd === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;
        return interaction.reply(user.displayAvatarURL({ size: 1024 }));
      }

      if (cmd === "userinfo") {
        const user = interaction.options.getUser("user") || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        const embed = premiumEmbed("👤 User Info", `${user}`)
          .addFields(
            { name: "Username", value: user.username, inline: true },
            { name: "ID", value: user.id, inline: true },
            { name: "Joined Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false },
            { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: false }
          )
          .setThumbnail(user.displayAvatarURL());
        return interaction.reply({ embeds: [embed] });
      }

      if (cmd === "serverinfo") {
        const embed = premiumEmbed("🏠 Server Info", interaction.guild.name)
          .addFields(
            { name: "Members", value: `${interaction.guild.memberCount}`, inline: true },
            { name: "Server ID", value: interaction.guild.id, inline: true },
            { name: "Created", value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`, inline: false }
          )
          .setThumbnail(interaction.guild.iconURL());
        return interaction.reply({ embeds: [embed] });
      }

      if (cmd === "addtoticket") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        const user = interaction.options.getUser("user");
        await addUserToTicket(interaction.channel, user.id);
        return interaction.reply(`✅ Added ${user} to the ticket.`);
      }

      if (cmd === "close") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        await interaction.reply("🔒 Closing ticket in 5 seconds...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "buyer_start") {
        if (!isBuyerTicket(interaction.channel)) return interaction.reply({ content: "❌ Buyer tickets only.", ephemeral: true });
        return buyerCategoryMenu(interaction);
      }

      if (interaction.customId === "mm_start") {
        if (!isMMTicket(interaction.channel)) return interaction.reply({ content: "❌ MM tickets only.", ephemeral: true });
        return interaction.reply({ content: "Choose trade size:", components: [mmSizeMenu()], ephemeral: true });
      }

      if (interaction.customId === "order_claim") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        return interaction.reply(`🙋 Order claimed by ${interaction.user}`);
      }

      if (interaction.customId === "order_paid") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        return interaction.reply("💳 Payment marked as received.");
      }

      if (interaction.customId === "order_done") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        return interaction.reply({
          content: `📦 Order delivered.\n\n⭐ **Vouch is required before this ticket is closed.**\nClick the button below to write your vouch.`,
          components: [vouchButton("buyer")]
        });
      }

      if (interaction.customId === "order_cancel") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        return interaction.reply("❌ Order cancelled.");
      }

      if (interaction.customId === "mm_claim") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        return interaction.reply(`🛡️ MM claimed by ${interaction.user}`);
      }

      if (interaction.customId === "mm_confirmed") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        return interaction.reply("✅ Both traders confirmed.");
      }

      if (interaction.customId === "mm_done") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        return interaction.reply({
          content: `📦 Trade completed.\n\n⭐ **Both traders should vouch before this ticket is closed.**\nClick below to write your MM vouch.`,
          components: [vouchButton("mm")]
        });
      }

      if (interaction.customId === "mm_cancel") {
        if (!onlyStaff(interaction.member)) return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        return interaction.reply("❌ MM request cancelled.");
      }

      if (interaction.customId === "vouch_buyer") {
        return vouchModal(interaction, "buyer");
      }

      if (interaction.customId === "vouch_mm") {
        return vouchModal(interaction, "mm");
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "buyer_category") {
        return itemMenu(interaction, interaction.values[0]);
      }

      if (interaction.customId.startsWith("buyer_item_")) {
        const category = interaction.customId.replace("buyer_item_", "");
        const itemName = interaction.values[0];

        if (itemName === "Other") return otherItemModal(interaction, category);
        return amountModal(interaction, category, itemName);
      }

      if (interaction.customId === "mm_size") {
        return mmModal(interaction, interaction.values[0]);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("buyer_other_")) {
        const category = interaction.customId.replace("buyer_other_", "");
        return sendOrderSummary(interaction, {
          category,
          item: interaction.fields.getTextInputValue("item"),
          amount: cleanAmount(interaction.fields.getTextInputValue("amount")),
          payment: interaction.fields.getTextInputValue("payment"),
          notes: interaction.fields.getTextInputValue("notes") || "None",
          price: null
        });
      }

      if (interaction.customId.startsWith("buyer_amount_")) {
        const parts = interaction.customId.split("_");
        const category = parts[2];
        const itemName = Buffer.from(parts.slice(3).join("_"), "base64").toString("utf8");

        return sendOrderSummary(interaction, {
          category,
          item: itemName,
          amount: cleanAmount(interaction.fields.getTextInputValue("amount")),
          payment: interaction.fields.getTextInputValue("payment"),
          notes: interaction.fields.getTextInputValue("notes") || "None",
          price: priceList[category][itemName]
        });
      }

      if (interaction.customId.startsWith("mm_modal_")) {
        const size = interaction.customId.replace("mm_modal_", "");
        const trader2Text = interaction.fields.getTextInputValue("trader2");

        const member = await resolveUserFromText(interaction.guild, trader2Text);
        if (member) {
          await addUserToTicket(interaction.channel, member.id);
        }

        return sendMMSummary(interaction, {
          size,
          trader2Text: member ? `${member.user}\n${member.user.username}` : `${trader2Text}\n⚠️ Could not auto-add user. Use /addtoticket.`,
          gives1: interaction.fields.getTextInputValue("gives1"),
          gives2: interaction.fields.getTextInputValue("gives2")
        });
      }

      if (interaction.customId === "vouch_modal_buyer") {
        return sendVouch(interaction, "buyer");
      }

      if (interaction.customId === "vouch_modal_mm") {
        return sendVouch(interaction, "mm");
      }
    }
  } catch (err) {
    console.log(err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
    }
  }
});

registerCommands();
client.login(TOKEN);