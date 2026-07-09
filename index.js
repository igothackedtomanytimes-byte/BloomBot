require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

// =======================
// WEB SERVER FOR RENDER
// =======================

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bloom Bot is online.");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =======================
// ENV
// =======================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Optional AI key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

// =======================
// MAIN IDS
// =======================

const OWNER_ID = "1442212943470264320";

// Ticket categories
const BUYER_CATEGORY_ID = "1524567770002489584";
const MM_CATEGORY_ID = "1524570656291688652";

// Roles
const NEW_MM_ROLE_ID = "1523782888296939660";
const MM_ROLE_ID = "1516085004801802260";
const TRUSTED_MM_ROLE_ID = "1523783007842992238";
const SELLER_ROLE_ID = "1516085109378252810";

// Vouch channels
const BUYER_VOUCH_CHANNEL_ID = "1516081257547825232";
const MM_VOUCH_CHANNEL_ID = "1523533160506327090";

// MM Application
const MM_APPLY_CATEGORY_OR_CHANNEL_ID = "1524639852128374825";
const MM_REVIEW_ROLE_ID = "1516084407528722604";

// =======================
// BOT STATE
// =======================

let aiMode = "normal"; 
// normal, funny, roast, mods, master

const mmApplications = new Map();
const vouchCompletedTickets = new Set();
const ticketClaims = new Map();

// =======================
// CLIENT
// =======================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// =======================
// PRICE LIST
// =======================

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

// =======================
// BASIC HELPERS
// =======================

function isOwner(userId) {
  return userId === OWNER_ID;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function cleanAmount(raw) {
  const n = Number(raw);
  if (isNaN(n) || n <= 0) return 1;
  return n;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function isBuyerTicket(channel) {
  return channel?.parentId === BUYER_CATEGORY_ID;
}

function isMMTicket(channel) {
  return channel?.parentId === MM_CATEGORY_ID;
}

function isMMApplyTicket(channel) {
  return (
    channel?.id === MM_APPLY_CATEGORY_OR_CHANNEL_ID ||
    channel?.parentId === MM_APPLY_CATEGORY_OR_CHANNEL_ID
  );
}

function onlyStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(SELLER_ROLE_ID) ||
    member.roles.cache.has(NEW_MM_ROLE_ID) ||
    member.roles.cache.has(MM_ROLE_ID) ||
    member.roles.cache.has(TRUSTED_MM_ROLE_ID)
  );
}

function staffOrOwner(interaction) {
  return isOwner(interaction.user.id) || onlyStaff(interaction.member);
}

function premiumEmbed(title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Bloom Bot • Premium Assistant" });
}

// =======================
// SECURITY / OWNER PROTECTION
// =======================

function funnyDeny() {
  return randomFrom([
    "💀 Nice try lil bro. This bot listens to the boss only.",
    "🚫 Access denied. You are not him.",
    "😂 Bro tried owner powers with a guest pass.",
    "🛡️ Nope. Only my owner can do that.",
    "😭 You clicked that like you owned the place.",
    "💀 Permission denied. The bot looked at you and said no."
  ]);
}

function ownerOnly(interaction) {
  if (!isOwner(interaction.user.id)) {
    interaction.reply({
      content: funnyDeny(),
      ephemeral: true
    });
    return false;
  }

  return true;
}

function protectOwnerTarget(interaction, user) {
  if (user && user.id === OWNER_ID && !isOwner(interaction.user.id)) {
    interaction.reply({
      content: "💀 You tried using the bot against my owner? Bold move. Bad move.",
      ephemeral: true
    });
    return false;
  }

  return true;
}

function masterModeBlock(interaction) {
  if (aiMode === "master" && !isOwner(interaction.user.id)) {
    interaction.reply({
      content: "💀 Master mode is active. I only listen to my owner right now.",
      ephemeral: true
    });
    return true;
  }

  return false;
}

// =======================
// TICKET PERMISSION HELPERS
// =======================

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

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(options);
    }

    return interaction.reply(options);
  } catch (err) {
    console.log("Safe reply failed:", err.message);
  }
}
// =======================
// BUYER SYSTEM
// =======================

function buyerPanel() {
  const embed = premiumEmbed(
    "🛒 Buyer Assistant",
    [
      "Welcome! Click **Start Order** and Bloom Bot will help you place your order.",
      "",
      "✅ Auto price calculator",
      "✅ Custom item option",
      "✅ Seller claim system",
      "✅ Required vouch after delivery"
    ].join("\n"),
    0x2ecc71
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
    new ButtonBuilder()
      .setCustomId("order_claim")
      .setLabel("Claim")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("order_paid")
      .setLabel("Paid")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("order_done")
      .setLabel("Delivered")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("order_cancel")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );
}

async function sendOrderSummary(interaction, data) {
  const orderId = Math.floor(100000 + Math.random() * 900000);

  let priceText = "Seller will provide price.";

  if (data.price !== null && data.price !== undefined) {
    const total = data.price * data.amount;
    priceText = `${money(data.price)} each\n**Total:** ${money(total)}`;
  }

  const embed = premiumEmbed(
    `🛒 Order #${orderId}`,
    "A new order has been created.",
    0x2ecc71
  ).addFields(
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

// =======================
// MIDDLEMAN SYSTEM
// =======================

function mmPanel() {
  const embed = premiumEmbed(
    "🛡️ Middleman Assistant",
    [
      "Welcome! Click **Start MM Request** and Bloom Bot will organize the trade.",
      "",
      "✅ Trader 1 is automatically you",
      "✅ Select Trader 2 from a menu",
      "✅ Bot adds Trader 2 to this ticket",
      "✅ Correct MM role is pinged",
      "✅ Required MM vouch after completion"
    ].join("\n"),
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

function mmSizeMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("mm_size")
    .setPlaceholder("Choose trade size")
    .addOptions(
      {
        label: "Small Trade",
        value: "small",
        emoji: "🔹",
        description: "Pings New MM"
      },
      {
        label: "Normal Trade",
        value: "normal",
        emoji: "🔸",
        description: "Pings MM"
      },
      {
        label: "Huge Trade",
        value: "huge",
        emoji: "🔶",
        description: "Pings Trusted MM"
      }
    );

  return new ActionRowBuilder().addComponents(menu);
}

async function traderSelectMenu(interaction, size) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId(`mm_trader_${size}`)
    .setPlaceholder("Select the other trader")
    .setMinValues(1)
    .setMaxValues(1);

  return interaction.reply({
    content: "👤 Select the **other trader**. Bloom Bot will add them to this ticket automatically.",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function mmModal(interaction, size, traderId) {
  const modal = new ModalBuilder()
    .setCustomId(`mm_modal_${size}_${traderId}`)
    .setTitle("Middleman Request");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives1")
        .setLabel("What are YOU giving?")
        .setPlaceholder("Example: $5 PayPal")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives2")
        .setLabel("What is the OTHER trader giving?")
        .setPlaceholder("Example: 20x Mega Seed")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

function mmButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_claim")
      .setLabel("Claim MM")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("mm_confirmed")
      .setLabel("Both Confirmed")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_done")
      .setLabel("Complete")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_cancel")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
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

  const trader2User = await client.users.fetch(data.trader2Id).catch(() => null);

  await addUserToTicket(interaction.channel, data.trader2Id);

  const embed = premiumEmbed(
    "🛡️ Middleman Request",
    "A new MM request has been created.",
    0x5865f2
  ).addFields(
    { name: "👤 Trader 1", value: `${interaction.user}\n${interaction.user.username}`, inline: true },
    {
      name: "👤 Trader 2",
      value: trader2User ? `${trader2User}\n${trader2User.username}` : `<@${data.trader2Id}>`,
      inline: true
    },
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
    content: "✅ MM request sent and the other trader was added to the ticket.",
    ephemeral: true
  });
}

// =======================
// VOUCH SYSTEM
// =======================

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
  vouchCompletedTickets.add(interaction.channel.id);

  return interaction.reply({
    content: `✅ Vouch sent to <#${channelId}>. Thank you!`,
    ephemeral: true
  });
}
// =======================
// MM APPLICATION SYSTEM
// =======================

function mmApplyPanel() {
  const embed = premiumEmbed(
    "🛡️ Middleman Application",
    [
      "Want to become a Middleman?",
      "",
      "Click **Start Application** and answer the form honestly.",
      "Bloom Bot will rate the application and ping the review team."
    ].join("\n"),
    0x5865f2
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_apply_start")
      .setLabel("Start Application")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function mmApplyModalPart1(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("mm_apply_part1")
    .setTitle("MM Application Part 1");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("vouches")
        .setLabel("How many vouches do you have?")
        .setPlaceholder("Example: 12")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("timezone")
        .setLabel("Timezone")
        .setPlaceholder("Example: GMT+3")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("activity")
        .setLabel("Daily Activity")
        .setPlaceholder("Example: 3-5 hours daily")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("server_time")
        .setLabel("How long in our server?")
        .setPlaceholder("Example: 2 weeks")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("active_needed")
        .setLabel("Can you be active when needed?")
        .setPlaceholder("Yes / No + explain")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

async function mmApplyModalPart2(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("mm_apply_part2")
    .setTitle("MM Application Part 2");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("experience")
        .setLabel("Previous MM experience? If yes, where?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("why_mm")
        .setLabel("Why do you want to become MM?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("why_choose")
        .setLabel("Why should we choose you?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

function rateMMApplication(data) {
  let score = 0;
  const notes = [];

  const vouchNumber = parseInt(String(data.vouches).replace(/\D/g, "")) || 0;

  if (vouchNumber >= 25) {
    score += 30;
    notes.push("✅ Very strong vouch count");
  } else if (vouchNumber >= 15) {
    score += 24;
    notes.push("✅ Strong vouch count");
  } else if (vouchNumber >= 8) {
    score += 16;
    notes.push("🟡 Decent vouch count");
  } else if (vouchNumber >= 3) {
    score += 8;
    notes.push("⚠️ Low but not zero vouch count");
  } else {
    score += 2;
    notes.push("❌ Very low vouch count");
  }

  if (data.activity.length >= 6) {
    score += 10;
  }

  if (data.server_time.length >= 4) {
    score += 10;
  }

  const activeText = data.active_needed.toLowerCase();

  if (activeText.includes("yes")) {
    score += 15;
    notes.push("✅ Says they can be active when needed");
  } else {
    notes.push("⚠️ Activity availability is unclear");
  }

  const exp = data.experience.toLowerCase();

  if (
    exp.includes("yes") ||
    exp.includes("server") ||
    exp.includes("mm") ||
    exp.includes("middleman")
  ) {
    score += 15;
    notes.push("✅ Has or explained MM experience");
  } else {
    score += 4;
    notes.push("⚠️ Little/no previous MM experience");
  }

  if (data.why_mm.length >= 50) {
    score += 15;
  } else if (data.why_mm.length >= 25) {
    score += 8;
  }

  if (data.why_choose.length >= 50) {
    score += 15;
  } else if (data.why_choose.length >= 25) {
    score += 8;
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) {
    return { score, rating: "🟢 Strong Application", notes };
  }

  if (score >= 55) {
    return { score, rating: "🟡 Medium Application", notes };
  }

  return { score, rating: "🔴 Weak Application", notes };
}

async function sendMMApplication(interaction, data) {
  const result = rateMMApplication(data);

  const embed = premiumEmbed(
    "🛡️ New Middleman Application",
    `${interaction.user} submitted a Middleman application.`,
    0x5865f2
  ).addFields(
    {
      name: "👤 Discord Username",
      value: `${interaction.user}\n${interaction.user.username}`,
      inline: false
    },
    {
      name: "🎂 Vouches",
      value: data.vouches || "None",
      inline: true
    },
    {
      name: "🌍 Timezone",
      value: data.timezone || "None",
      inline: true
    },
    {
      name: "⏰ Daily Activity",
      value: data.activity || "None",
      inline: false
    },
    {
      name: "📅 Time in Server",
      value: data.server_time || "None",
      inline: false
    },
    {
      name: "📱 Active When Needed?",
      value: data.active_needed || "None",
      inline: false
    },
    {
      name: "🤝 Previous MM Experience",
      value: data.experience || "None",
      inline: false
    },
    {
      name: "💬 Why Become MM?",
      value: data.why_mm || "None",
      inline: false
    },
    {
      name: "⭐ Why Choose Them?",
      value: data.why_choose || "None",
      inline: false
    },
    {
      name: "📊 Bot Rating",
      value: `${result.rating}\nScore: **${result.score}/100**\n${result.notes.join("\n")}`,
      inline: false
    }
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_app_accept")
      .setLabel("Accept")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_app_deny")
      .setLabel("Deny")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.channel.send({
    content: `<@&${MM_REVIEW_ROLE_ID}> New Middleman application!`,
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: "✅ Your application was submitted. Staff will review it soon.",
    ephemeral: true
  });
}
// =======================
// AI SYSTEM
// =======================

let openai = null;

try {
  if (OPENAI_API_KEY) {
    const OpenAI = require("openai");

    openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    console.log("🤖 OpenAI AI system loaded.");
  } else {
    console.log("⚠️ OPENAI_API_KEY not found. AI commands will use fallback replies.");
  }
} catch (err) {
  console.log("⚠️ OpenAI package not installed or failed to load:", err.message);
}

function aiModePrompt() {
  if (aiMode === "funny") {
    return [
      "You are Bloom Bot in FUNNY mode.",
      "You are a Discord marketplace assistant.",
      "Be helpful but make funny jokes.",
      "Keep replies short, clean, and Discord-safe.",
      "Do not be hateful or extreme."
    ].join(" ");
  }

  if (aiMode === "roast") {
    return [
      "You are Bloom Bot in ROAST mode.",
      "Give playful roasts only.",
      "Do not use slurs, hate, threats, harassment, or extreme insults.",
      "Keep it funny and Discord-safe.",
      "Keep replies short."
    ].join(" ");
  }

  if (aiMode === "mods") {
    return [
      "You are Bloom Bot in MODS mode.",
      "Help Discord staff with moderation, tickets, announcements, rules, and conflict handling.",
      "Be professional, clear, and short.",
      "Never encourage abuse of power."
    ].join(" ");
  }

  if (aiMode === "master") {
    return [
      "You are Bloom Bot in MASTER mode.",
      "Only the owner is allowed to use you.",
      "Be loyal, funny, and short.",
      "Never help other users control the bot."
    ].join(" ");
  }

  return [
    "You are Bloom Bot, a helpful Discord marketplace assistant.",
    "Help with trading, tickets, announcements, middleman requests, and server questions.",
    "Keep replies short, friendly, and useful."
  ].join(" ");
}

function fallbackAI(message) {
  const msg = message.toLowerCase();

  if (aiMode === "funny") {
    return randomFrom([
      "😂 I would answer that, but my last braincell is still loading.",
      "💀 That question hit harder than a failed trade.",
      "🤣 Bloom Bot says: maybe, but ask a staff member before you cook the server.",
      "😭 I got you, but keep it simple before I start overheating."
    ]);
  }

  if (aiMode === "roast") {
    return randomFrom([
      "💀 Your question has the same value as an out-of-stock item.",
      "😭 Bro asked that like the answer was hiding in his inventory.",
      "😂 Your WiFi probably typed that question for you.",
      "💀 That message came with 900 ping."
    ]);
  }

  if (aiMode === "mods") {
    return "🛡️ Mod suggestion: stay calm, check proof, explain the rule clearly, and avoid making decisions without evidence.";
  }

  if (msg.includes("ticket")) {
    return "🎫 For ticket help: explain what you need clearly, wait for staff, and do not spam pings.";
  }

  if (msg.includes("vouch")) {
    return "⭐ For vouches: write a short honest review after the order or MM trade is complete.";
  }

  return "🤖 AI is not fully connected yet. Add `OPENAI_API_KEY` in Render and run `npm install openai` to enable real AI.";
}

async function askBloomAI(interaction, message) {
  if (aiMode === "master" && !isOwner(interaction.user.id)) {
    return interaction.reply({
      content: "💀 Master mode is active. I only listen to my owner. Go open a ticket or something.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  if (!openai) {
    return interaction.editReply(fallbackAI(message));
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: aiModePrompt()
        },
        {
          role: "user",
          content: `${interaction.user.username}: ${message}`
        }
      ],
      max_tokens: 220
    });

    const answer =
      response.choices?.[0]?.message?.content ||
      "🤖 I could not think of a reply.";

    return interaction.editReply(answer.slice(0, 1900));
  } catch (err) {
    console.log("AI error:", err.message);
    return interaction.editReply("⚠️ AI had an error. Check your OpenAI key or billing.");
  }
}

// =======================
// FUN COMMAND HELPERS
// =======================

function roastLine() {
  return randomFrom([
    "Your WiFi has more stability than your trades.",
    "You joined the ticket and even the bot got confused.",
    "Bro is moving like a loading screen.",
    "Your luck is lower than out-of-stock items.",
    "You got rejected by the loading bar.",
    "Your trade history looks like a warning label.",
    "You type like your keyboard is in spectator mode.",
    "Your deal was so bad even the calculator left."
  ]);
}

function eightBallAnswer() {
  return randomFrom([
    "Yes.",
    "No.",
    "Maybe.",
    "100%.",
    "Not today.",
    "Ask again later.",
    "Looks good.",
    "Bad idea.",
    "The bot council says no.",
    "Only if your WiFi survives."
  ]);
}

function fakeHackText(user) {
  return [
    `💻 Hacking ${user}...`,
    "[█▒▒▒▒▒▒▒▒▒] 10%",
    "[████▒▒▒▒▒▒] 40%",
    "[████████▒▒] 80%",
    "[██████████] 100%",
    "",
    "Result: found 0 brain cells, 900 ping, and one suspicious inventory."
  ].join("\n");
}

function rpsResult(userChoice) {
  const choices = ["rock", "paper", "scissors"];
  const botChoice = randomFrom(choices);

  let result = "It's a tie.";

  if (
    (userChoice === "rock" && botChoice === "scissors") ||
    (userChoice === "paper" && botChoice === "rock") ||
    (userChoice === "scissors" && botChoice === "paper")
  ) {
    result = "You win.";
  } else if (userChoice !== botChoice) {
    result = "I win.";
  }

  return `✊📄✂️ You chose **${userChoice}**, I chose **${botChoice}**. **${result}**`;
}
// =======================
// SLASH COMMANDS
// =======================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send ticket assistant panel"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show commands"),

  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Owner only: change Bloom AI mode")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Choose mode")
        .setRequired(true)
        .addChoices(
          { name: "Normal", value: "normal" },
          { name: "Funny", value: "funny" },
          { name: "Roast", value: "roast" },
          { name: "Mods", value: "mods" },
          { name: "Master", value: "master" }
        )
    ),

  new SlashCommandBuilder()
    .setName("stopai")
    .setDescription("Owner only: reset AI mode"),

  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Talk to Bloom AI")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("What do you want to say?")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin"),

  new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the magic 8ball")
    .addStringOption(o =>
      o.setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rate")
    .setDescription("Rate something")
    .addStringOption(o =>
      o.setName("thing")
        .setDescription("Thing to rate")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Funny roast")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("fakeban")
    .setDescription("Fake ban someone for fun")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("hack")
    .setDescription("Fake hack someone for fun")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll a dice"),

  new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Rock paper scissors")
    .addStringOption(o =>
      o.setName("choice")
        .setDescription("Choose")
        .setRequired(true)
        .addChoices(
          { name: "Rock", value: "rock" },
          { name: "Paper", value: "paper" },
          { name: "Scissors", value: "scissors" }
        )
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Staff only: make the bot say something")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Staff only: make a clean embed")
    .addStringOption(o =>
      o.setName("title")
        .setDescription("Title")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Staff only: send a clean announcement")
    .addStringOption(o =>
      o.setName("title")
        .setDescription("Announcement title")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("ping")
        .setDescription("Optional role to ping")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show avatar")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show user info")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("addtoticket")
    .setDescription("Staff only: add a user to this ticket")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to add")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("mmapplypanel")
    .setDescription("Send the MM application panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Staff only: close/delete this ticket")
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered.");
}
// =======================
// MAIN INTERACTION HANDLER
// =======================

client.on("interactionCreate", async interaction => {
  try {
    // =======================
    // SLASH COMMANDS
    // =======================

    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      if (aiMode === "master" && !isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "💀 Master mode is active. I only listen to my owner right now.",
          ephemeral: true
        });
      }

      if (cmd === "mode") {
        if (!ownerOnly(interaction)) return;

        aiMode = interaction.options.getString("type");

        return interaction.reply(
          `👑 Yes master. Bloom AI mode changed to **${aiMode.toUpperCase()}**.`
        );
      }

      if (cmd === "stopai") {
        if (!ownerOnly(interaction)) return;

        aiMode = "normal";

        return interaction.reply("✅ Bloom AI is back to **NORMAL MODE**.");
      }

      if (cmd === "ai") {
        const message = interaction.options.getString("message");
        return askBloomAI(interaction, message);
      }

      if (cmd === "ping") {
        return interaction.reply({
          content: `🏓 Pong! ${client.ws.ping}ms`,
          ephemeral: true
        });
      }

      if (cmd === "help") {
        const embed = premiumEmbed(
          "🌱 Bloom Bot Commands",
          `Current AI Mode: **${aiMode.toUpperCase()}**`
        ).addFields(
          {
            name: "👑 Owner",
            value: "`/mode` `/stopai`"
          },
          {
            name: "🤖 AI",
            value: "`/ai`"
          },
          {
            name: "🎫 Ticket",
            value: "`/panel` `/addtoticket` `/close` `/mmapplypanel`"
          },
          {
            name: "🛒 Buyer",
            value: "Buyer Assistant auto-posts in buyer tickets."
          },
          {
            name: "🛡️ MM",
            value: "MM Assistant auto-posts in MM tickets."
          },
          {
            name: "🎉 Fun",
            value: "`/coinflip` `/8ball` `/rate` `/roast` `/fakeban` `/hack` `/dice` `/rps`"
          },
          {
            name: "🧰 Useful",
            value: "`/avatar` `/userinfo` `/serverinfo` `/say` `/embed` `/announce`"
          }
        );

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (cmd === "panel") {
        if (isBuyerTicket(interaction.channel)) return interaction.reply(buyerPanel());
        if (isMMTicket(interaction.channel)) return interaction.reply(mmPanel());
        if (isMMApplyTicket(interaction.channel)) return interaction.reply(mmApplyPanel());

        return interaction.reply({
          content: "❌ This only works in ticket categories.",
          ephemeral: true
        });
      }

      if (cmd === "mmapplypanel") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        if (!isMMApplyTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ This only works in the MM application ticket/channel.",
            ephemeral: true
          });
        }

        return interaction.reply(mmApplyPanel());
      }

      if (cmd === "coinflip") {
        return interaction.reply(`🪙 ${Math.random() < 0.5 ? "Heads" : "Tails"}`);
      }

      if (cmd === "8ball") {
        return interaction.reply(`🎱 ${eightBallAnswer()}`);
      }

      if (cmd === "rate") {
        const thing = interaction.options.getString("thing");
        const rating = Math.floor(Math.random() * 101);

        return interaction.reply(`📊 I rate **${thing}** a **${rating}/100**`);
      }

      if (cmd === "roast") {
        const user = interaction.options.getUser("user") || interaction.user;

        if (!protectOwnerTarget(interaction, user)) return;

        return interaction.reply(`${user} ${roastLine()}`);
      }

      if (cmd === "fakeban") {
        const user = interaction.options.getUser("user");

        if (!protectOwnerTarget(interaction, user)) return;

        return interaction.reply(
          `🔨 ${user} has been fake banned for being too suspicious. Just kidding 😭`
        );
      }

      if (cmd === "hack") {
        const user = interaction.options.getUser("user");

        if (!protectOwnerTarget(interaction, user)) return;

        return interaction.reply(fakeHackText(user));
      }

      if (cmd === "dice") {
        return interaction.reply(`🎲 You rolled **${Math.floor(Math.random() * 6) + 1}**`);
      }

      if (cmd === "rps") {
        const choice = interaction.options.getString("choice");
        return interaction.reply(rpsResult(choice));
      }

      if (cmd === "say") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        const msg = interaction.options.getString("message");

        await interaction.reply({
          content: "✅ Sent.",
          ephemeral: true
        });

        return interaction.channel.send(msg);
      }

      if (cmd === "embed") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        const title = interaction.options.getString("title");
        const message = interaction.options.getString("message");

        return interaction.reply({
          embeds: [premiumEmbed(title, message)]
        });
      }

      if (cmd === "announce") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        const title = interaction.options.getString("title");
        const message = interaction.options.getString("message");
        const role = interaction.options.getRole("ping");

        await interaction.reply({
          content: "✅ Announcement sent.",
          ephemeral: true
        });

        return interaction.channel.send({
          content: role ? `${role}` : null,
          embeds: [premiumEmbed(title, message)]
        });
      }

      if (cmd === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;

        return interaction.reply(
          user.displayAvatarURL({
            size: 1024
          })
        );
      }

      if (cmd === "userinfo") {
        const user = interaction.options.getUser("user") || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const embed = premiumEmbed("👤 User Info", `${user}`)
          .addFields(
            {
              name: "Username",
              value: user.username,
              inline: true
            },
            {
              name: "ID",
              value: user.id,
              inline: true
            },
            {
              name: "Joined Server",
              value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
              inline: false
            },
            {
              name: "Account Created",
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
              inline: false
            }
          )
          .setThumbnail(user.displayAvatarURL());

        return interaction.reply({
          embeds: [embed]
        });
      }

      if (cmd === "serverinfo") {
        const embed = premiumEmbed("🏠 Server Info", interaction.guild.name)
          .addFields(
            {
              name: "Members",
              value: `${interaction.guild.memberCount}`,
              inline: true
            },
            {
              name: "Server ID",
              value: interaction.guild.id,
              inline: true
            },
            {
              name: "Created",
              value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`,
              inline: false
            }
          )
          .setThumbnail(interaction.guild.iconURL());

        return interaction.reply({
          embeds: [embed]
        });
      }

      if (cmd === "addtoticket") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        const user = interaction.options.getUser("user");

        await addUserToTicket(interaction.channel, user.id);

        return interaction.reply(`✅ Added ${user} to the ticket.`);
      }

      if (cmd === "close") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: funnyDeny(),
            ephemeral: true
          });
        }

        if (
          (isBuyerTicket(interaction.channel) || isMMTicket(interaction.channel)) &&
          !vouchCompletedTickets.has(interaction.channel.id) &&
          !isOwner(interaction.user.id)
        ) {
          return interaction.reply({
            content: "⭐ This ticket cannot be closed yet. A vouch is required first.",
            ephemeral: true
          });
        }

        await interaction.reply("🔒 Closing ticket in 5 seconds...");

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 5000);
      }
    }
        // =======================
    // BUTTONS
    // =======================

    if (interaction.isButton()) {
      if (masterModeBlock(interaction)) return;

      if (interaction.customId === "buyer_start") {
        if (!isBuyerTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ Buyer tickets only.",
            ephemeral: true
          });
        }

        return buyerCategoryMenu(interaction);
      }

      if (interaction.customId === "mm_start") {
        if (!isMMTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ MM tickets only.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "Choose trade size:",
          components: [mmSizeMenu()],
          ephemeral: true
        });
      }

      if (interaction.customId === "mm_apply_start") {
        if (!isMMApplyTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ This only works in MM application tickets.",
            ephemeral: true
          });
        }

        return mmApplyModalPart1(interaction);
      }

      if (interaction.customId === "mm_apply_continue") {
        return mmApplyModalPart2(interaction);
      }

      if (interaction.customId === "mm_app_accept") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ Staff only.",
            ephemeral: true
          });
        }

        return interaction.reply("✅ Application marked as accepted.");
      }

      if (interaction.customId === "mm_app_deny") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ Staff only.",
            ephemeral: true
          });
        }

        return interaction.reply("❌ Application marked as denied.");
      }

      if (interaction.customId === "order_claim") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Sellers only.",
            ephemeral: true
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        return interaction.reply(`🙋 Order claimed by ${interaction.user}`);
      }

      if (interaction.customId === "order_paid") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Sellers only.",
            ephemeral: true
          });
        }

        return interaction.reply("💳 Payment marked as received.");
      }

      if (interaction.customId === "order_done") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Sellers only.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "📦 Order delivered.\n\n⭐ **Vouch is required before this ticket is closed.**\nClick the button below to write your vouch.",
          components: [vouchButton("buyer")]
        });
      }

      if (interaction.customId === "order_cancel") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Sellers only.",
            ephemeral: true
          });
        }

        return interaction.reply("❌ Order cancelled.");
      }

      if (interaction.customId === "mm_claim") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ MM only.",
            ephemeral: true
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        return interaction.reply(`🛡️ MM claimed by ${interaction.user}`);
      }

      if (interaction.customId === "mm_confirmed") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ MM only.",
            ephemeral: true
          });
        }

        return interaction.reply("✅ Both traders confirmed.");
      }

      if (interaction.customId === "mm_done") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ MM only.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "📦 Trade completed.\n\n⭐ **Both traders should vouch before this ticket is closed.**\nClick below to write your MM vouch.",
          components: [vouchButton("mm")]
        });
      }

      if (interaction.customId === "mm_cancel") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ MM only.",
            ephemeral: true
          });
        }

        return interaction.reply("❌ MM request cancelled.");
      }

      if (interaction.customId === "vouch_buyer") {
        return vouchModal(interaction, "buyer");
      }

      if (interaction.customId === "vouch_mm") {
        return vouchModal(interaction, "mm");
      }
    }

    // =======================
    // STRING SELECT MENUS
    // =======================

    if (interaction.isStringSelectMenu()) {
      if (masterModeBlock(interaction)) return;

      if (interaction.customId === "buyer_category") {
        return itemMenu(interaction, interaction.values[0]);
      }

      if (interaction.customId.startsWith("buyer_item_")) {
        const category = interaction.customId.replace("buyer_item_", "");
        const itemName = interaction.values[0];

        if (itemName === "Other") {
          return otherItemModal(interaction, category);
        }

        return amountModal(interaction, category, itemName);
      }

      if (interaction.customId === "mm_size") {
        const size = interaction.values[0];
        return traderSelectMenu(interaction, size);
      }
    }

    // =======================
    // USER SELECT MENUS
    // =======================

    if (interaction.isUserSelectMenu()) {
      if (masterModeBlock(interaction)) return;

      if (interaction.customId.startsWith("mm_trader_")) {
        const size = interaction.customId.replace("mm_trader_", "");
        const traderId = interaction.values[0];

        if (traderId === interaction.user.id) {
          return interaction.reply({
            content: "😭 You cannot select yourself as the other trader.",
            ephemeral: true
          });
        }

        await addUserToTicket(interaction.channel, traderId);

        return mmModal(interaction, size, traderId);
      }
    }
        // =======================
    // MODALS
    // =======================

    if (interaction.isModalSubmit()) {
      if (masterModeBlock(interaction)) return;

      if (interaction.customId === "mm_apply_part1") {
        mmApplications.set(interaction.user.id, {
          vouches: interaction.fields.getTextInputValue("vouches"),
          timezone: interaction.fields.getTextInputValue("timezone"),
          activity: interaction.fields.getTextInputValue("activity"),
          server_time: interaction.fields.getTextInputValue("server_time"),
          active_needed: interaction.fields.getTextInputValue("active_needed")
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("mm_apply_continue")
            .setLabel("Continue Part 2")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({
          content: "✅ Part 1 saved. Click below to continue.",
          components: [row],
          ephemeral: true
        });
      }

      if (interaction.customId === "mm_apply_part2") {
        const part1 = mmApplications.get(interaction.user.id);

        if (!part1) {
          return interaction.reply({
            content: "❌ Please start the application again.",
            ephemeral: true
          });
        }

        const fullData = {
          ...part1,
          experience: interaction.fields.getTextInputValue("experience"),
          why_mm: interaction.fields.getTextInputValue("why_mm"),
          why_choose: interaction.fields.getTextInputValue("why_choose")
        };

        mmApplications.delete(interaction.user.id);

        return sendMMApplication(interaction, fullData);
      }

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
        const parts = interaction.customId.split("_");
        const size = parts[2];
        const trader2Id = parts[3];

        return sendMMSummary(interaction, {
          size,
          trader2Id,
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
      return interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      });
    }
  }
});

// =======================
// AUTO PANELS ON TICKET CREATE
// =======================

client.on("channelCreate", async channel => {
  setTimeout(async () => {
    try {
      if (!channel || !channel.isTextBased()) return;

      if (isBuyerTicket(channel)) {
        await channel.send(buyerPanel());
      }

      if (isMMTicket(channel)) {
        await channel.send(mmPanel());
      }

      if (isMMApplyTicket(channel)) {
        await channel.send(mmApplyPanel());
      }
    } catch (err) {
      console.log("Auto panel error:", err.message);
    }
  }, 2500);
});

// =======================
// BOT READY
// =======================

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =======================
// START BOT
// =======================

registerCommands();
client.login(TOKEN);