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
// RENDER WEB SERVER
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

// =======================
// IDS
// =======================

const OWNER_ID = "1442212943470264320";

const BUYER_CATEGORY_ID = "1524567770002489584";
const MM_CATEGORY_ID = "1524570656291688652";

const NEW_MM_ROLE_ID = "1523782888296939660";
const MM_ROLE_ID = "1516085004801802260";
const TRUSTED_MM_ROLE_ID = "1523783007842992238";
const SELLER_ROLE_ID = "1516085109378252810";

const BUYER_VOUCH_CHANNEL_ID = "1516081257547825232";
const MM_VOUCH_CHANNEL_ID = "1523533160506327090";

const MM_APPLY_CATEGORY_OR_CHANNEL_ID = "1524639852128374825";
const MM_REVIEW_ROLE_ID = "1516084407528722604";

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
// TEMP DATABASE
// =======================
// This resets if bot restarts. Later we can add JSON/database save.

const ticketClaims = new Map();
const vouchCompletedTickets = new Set();
const mmApplications = new Map();

const storeCredits = new Map();
// userId -> number

const discountCodes = new Map();
/*
code -> {
  code,
  type: "percent" | "dollar",
  amount: number,
  maxUses: number,
  used: number,
  createdBy: string
}
*/

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
// HELPERS
// =======================

function isOwner(userId) {
  return userId === OWNER_ID;
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function cleanAmount(raw) {
  const n = Number(raw);
  if (isNaN(n) || n <= 0) return 1;
  return n;
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

function denyFunny() {
  const replies = [
    "💀 Nice try lil bro. Staff only.",
    "🚫 Access denied. You are not him.",
    "😭 Bro tried to use staff powers with a guest pass.",
    "🛡️ Nope. This button is not for you."
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function premiumEmbed(title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Bloom Bot • Ticket Assistant" });
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

// =======================
// STORE CREDIT
// =======================

function getCredit(userId) {
  return Number(storeCredits.get(userId) || 0);
}

function addCredit(userId, amount) {
  const current = getCredit(userId);
  const next = current + Number(amount || 0);
  storeCredits.set(userId, Math.max(0, next));
  return getCredit(userId);
}

function removeCredit(userId, amount) {
  const current = getCredit(userId);
  const next = current - Number(amount || 0);
  storeCredits.set(userId, Math.max(0, next));
  return getCredit(userId);
}

// =======================
// DISCOUNT CODES
// =======================

function createDiscountCode(code, type, amount, maxUses, createdBy) {
  const cleanCode = code.toUpperCase().trim();

  discountCodes.set(cleanCode, {
    code: cleanCode,
    type,
    amount: Number(amount),
    maxUses: Number(maxUses),
    used: 0,
    createdBy
  });

  return discountCodes.get(cleanCode);
}

function getDiscountCode(code) {
  if (!code) return null;
  return discountCodes.get(code.toUpperCase().trim()) || null;
}

function canUseDiscount(codeData) {
  if (!codeData) return false;
  return codeData.used < codeData.maxUses;
}

function calculateDiscount(total, codeData) {
  if (!codeData || !canUseDiscount(codeData)) {
    return {
      discountAmount: 0,
      finalAfterDiscount: total,
      discountText: "No discount"
    };
  }

  let discountAmount = 0;

  if (codeData.type === "percent") {
    discountAmount = total * (codeData.amount / 100);
  }

  if (codeData.type === "dollar") {
    discountAmount = codeData.amount;
  }

  discountAmount = Math.min(total, discountAmount);

  return {
    discountAmount,
    finalAfterDiscount: Math.max(0, total - discountAmount),
    discountText:
      codeData.type === "percent"
        ? `${codeData.amount}% off`
        : `${money(codeData.amount)} off`
  };
}

function calculateFinalTotal({ price, quantity, discountCode, buyerId, useCredit }) {
  const originalTotal = price !== null && price !== undefined ? Number(price) * Number(quantity) : null;

  if (originalTotal === null) {
    return {
      originalTotal: null,
      discountAmount: 0,
      creditUsed: 0,
      finalTotal: null,
      discountText: "Seller will price this item"
    };
  }

  const codeData = getDiscountCode(discountCode);
  const discount = calculateDiscount(originalTotal, codeData);

  let creditUsed = 0;
  let finalTotal = discount.finalAfterDiscount;

  if (useCredit) {
    const availableCredit = getCredit(buyerId);
    creditUsed = Math.min(availableCredit, finalTotal);
    finalTotal = Math.max(0, finalTotal - creditUsed);
  }

  return {
    originalTotal,
    discountAmount: discount.discountAmount,
    creditUsed,
    finalTotal,
    discountText: discount.discountText,
    codeData
  };
}

// =======================
// DISCOUNT CREATE MODAL
// =======================

async function discountCreateModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("discount_create_modal")
    .setTitle("Create Discount Code");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("code")
        .setLabel("Discount code")
        .setPlaceholder("Example: SAVE10")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("type")
        .setLabel("Type: percent or dollar")
        .setPlaceholder("percent OR dollar")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Amount")
        .setPlaceholder("Example: 10 for 10% or 2 for $2 off")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("uses")
        .setLabel("How many times can it be used?")
        .setPlaceholder("Example: 5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}
// =======================
// BUYER TICKET SYSTEM
// =======================

function buyerPanel() {
  const embed = premiumEmbed(
    "🛒 Purchase Assistant",
    [
      "Welcome to your purchase ticket.",
      "",
      "Click **Start Order** and answer the questions.",
      "A seller will claim your order and help you finish.",
      "",
      "✅ Prices are calculated automatically when possible",
      "✅ Discount codes supported",
      "✅ Store credit supported",
      "✅ Vouch required after delivery"
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
    content: "🛒 What do you want to buy?",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function buyerItemMenu(interaction, category) {
  if (category === "other") return buyerCustomOrderModal(interaction, "other", "Custom Item", null);

  const options = Object.entries(priceList[category]).map(([name, price]) => ({
    label: name,
    value: name,
    description: `Price: ${money(price)}`
  }));

  options.push({
    label: "Other",
    value: "Other",
    description: "Type your own item"
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

async function buyerCustomOrderModal(interaction, category, itemName, itemPrice) {
  const encodedItem = Buffer.from(itemName || "Custom Item").toString("base64");
  const encodedPrice = itemPrice === null || itemPrice === undefined ? "custom" : String(itemPrice);

  const modal = new ModalBuilder()
    .setCustomId(`buyer_order_${category}_${encodedPrice}_${encodedItem}`)
    .setTitle("Order Details");

  const components = [];

  if (itemName === "Custom Item") {
    components.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("custom_item")
          .setLabel("What item do you want?")
          .setPlaceholder("Example: Rainbow Butterfly")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("How many?")
        .setPlaceholder("Example: 1, 5, 20")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  components.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("payment")
        .setLabel("Payment method")
        .setPlaceholder("PayPal / Gift Card / Crypto / Other")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  components.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("discount")
        .setLabel("Discount code")
        .setPlaceholder("Optional. Example: SAVE10")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  components.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("credit")
        .setLabel("Use store credit?")
        .setPlaceholder("yes or no")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  modal.addComponents(...components.slice(0, 5));
  return interaction.showModal(modal);
}

function orderButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("order_claim")
      .setLabel("Claim Order")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("order_paid")
      .setLabel("Payment Received")
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

  const calc = calculateFinalTotal({
    price: data.price,
    quantity: data.amount,
    discountCode: data.discountCode,
    buyerId: interaction.user.id,
    useCredit: data.useCredit
  });

  if (calc.codeData && canUseDiscount(calc.codeData)) {
    calc.codeData.used += 1;
  }

  if (calc.creditUsed > 0) {
    removeCredit(interaction.user.id, calc.creditUsed);
  }

  let priceBlock = "Seller will provide price.";
  if (calc.originalTotal !== null) {
    priceBlock = [
      `Original Total: **${money(calc.originalTotal)}**`,
      `Discount: **-${money(calc.discountAmount)}** ${data.discountCode ? `(${data.discountCode.toUpperCase()})` : ""}`,
      `Store Credit Used: **-${money(calc.creditUsed)}**`,
      `Final Total: **${money(calc.finalTotal)}**`
    ].join("\n");
  }

  const creditLeft = getCredit(interaction.user.id);

  const embed = premiumEmbed(
    `🛒 Order #${orderId}`,
    "A new order has been created. A seller should claim this ticket before helping.",
    0x2ecc71
  ).addFields(
    { name: "👤 Buyer", value: `${interaction.user}\n${interaction.user.username}`, inline: false },
    { name: "📦 Category", value: data.category, inline: true },
    { name: "🛍️ Item", value: data.item, inline: true },
    { name: "🔢 Amount", value: String(data.amount), inline: true },
    { name: "💰 Price", value: priceBlock, inline: false },
    { name: "🎟️ Discount Code", value: data.discountCode || "None", inline: true },
    { name: "🏦 Store Credit Left", value: money(creditLeft), inline: true },
    { name: "💳 Payment", value: data.payment, inline: false },
    { name: "📌 Status", value: "🟡 Waiting for Seller", inline: false }
  );

  await interaction.channel.send({
    content: `<@&${SELLER_ROLE_ID}> New order waiting!`,
    embeds: [embed],
    components: [orderButtons()]
  });

  return interaction.reply({
    content: "✅ Your order was created. A seller will help you soon.",
    ephemeral: true
  });
}

// =======================
// MM TICKET SYSTEM
// =======================

function mmPanel() {
  const embed = premiumEmbed(
    "🛡️ Middleman Assistant",
    [
      "Welcome to your MM ticket.",
      "",
      "Click **Start MM Request** and Bloom Bot will guide you.",
      "",
      "✅ Select the other trader",
      "✅ Bot adds them to this ticket",
      "✅ Choose trade size",
      "✅ Correct MM role gets pinged",
      "✅ Claim system prevents MM fighting",
      "✅ Vouch required after trade"
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
      { label: "Small Trade", value: "small", emoji: "🔹", description: "Pings New MM" },
      { label: "Normal Trade", value: "normal", emoji: "🔸", description: "Pings MM" },
      { label: "Huge Trade", value: "huge", emoji: "🔶", description: "Pings Trusted MM" }
    );

  return new ActionRowBuilder().addComponents(menu);
}

async function mmTraderSelect(interaction, size) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId(`mm_trader_${size}`)
    .setPlaceholder("Select the other trader")
    .setMinValues(1)
    .setMaxValues(1);

  return interaction.reply({
    content: "👤 Select the **other trader**. Bloom Bot will add them to this ticket.",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function mmTradeModal(interaction, size, traderId) {
  const modal = new ModalBuilder()
    .setCustomId(`mm_trade_${size}_${traderId}`)
    .setTitle("MM Trade Details");

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
        .setPlaceholder("Example: 20x Mega Seeds")
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
      .setLabel("Trade Complete")
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

  await addUserToTicket(interaction.channel, data.trader2Id);

  const trader2 = await client.users.fetch(data.trader2Id).catch(() => null);

  const embed = premiumEmbed(
    "🛡️ Middleman Request",
    "A new middleman request has been created.",
    0x5865f2
  ).addFields(
    { name: "👤 Trader 1", value: `${interaction.user}\n${interaction.user.username}`, inline: true },
    { name: "👤 Trader 2", value: trader2 ? `${trader2}\n${trader2.username}` : `<@${data.trader2Id}>`, inline: true },
    { name: "📦 Trader 1 Gives", value: data.gives1, inline: false },
    { name: "📦 Trader 2 Gives", value: data.gives2, inline: false },
    { name: "📊 Trade Size", value: sizeText, inline: true },
    { name: "📌 Status", value: `🟡 ${statusText}`, inline: true },
    { name: "🛡️ Claimed By", value: "Not claimed yet", inline: false }
  );

  await interaction.channel.send({
    content: `<@&${roleId}> New MM request!`,
    embeds: [embed],
    components: [mmButtons()]
  });

  return interaction.reply({
    content: "✅ MM request created. The other trader was added to this ticket.",
    ephemeral: true
  });
}
// =======================
// STAFF APPLICATION SYSTEM
// =======================

function applicationPanel() {
  const embed = premiumEmbed(
    "📝 Staff Applications",
    [
      "Want to help the server?",
      "",
      "Click **Start Application** below.",
      "Bloom Bot will ask what position you want to apply for.",
      "",
      "Available positions:",
      "🛡️ Middleman",
      "👑 Admin"
    ].join("\n"),
    0x5865f2
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("apply_start")
      .setLabel("Start Application")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function applicationChoiceButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("apply_mm")
      .setLabel("Middleman")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("apply_admin")
      .setLabel("Admin")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Success)
  );
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

async function adminApplyModalPart1(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("admin_apply_part1")
    .setTitle("Admin Application Part 1");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("age")
        .setLabel("Age")
        .setPlaceholder("Example: 14")
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
        .setCustomId("staff_exp")
        .setLabel("Previous staff/admin experience?")
        .setPlaceholder("Yes / No + where")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

async function adminApplyModalPart2(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("admin_apply_part2")
    .setTitle("Admin Application Part 2");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_breaker")
        .setLabel("What if someone breaks rules?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("staff_abuse")
        .setLabel("What if staff abuses power?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("why_admin")
        .setLabel("Why do you want admin?")
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

function rateApplication(type, data) {
  let score = 0;
  const notes = [];

  if (type === "mm") {
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
    } else {
      score += 5;
      notes.push("⚠️ Low vouch count");
    }

    if (data.active_needed.toLowerCase().includes("yes")) score += 15;
    if (data.activity.length >= 6) score += 10;
    if (data.server_time.length >= 4) score += 10;
    if (data.experience.length >= 20) score += 15;
    if (data.why_mm.length >= 40) score += 15;
    if (data.why_choose.length >= 40) score += 15;
  }

  if (type === "admin") {
    const ageNum = parseInt(String(data.age).replace(/\D/g, "")) || 0;

    if (ageNum >= 14) {
      score += 15;
      notes.push("✅ Age looks mature enough");
    } else if (ageNum >= 12) {
      score += 8;
      notes.push("🟡 Young, but possible if responsible");
    } else {
      score += 2;
      notes.push("⚠️ Very young for admin");
    }

    if (data.activity.length >= 6) score += 10;
    if (data.server_time.length >= 4) score += 10;
    if (data.staff_exp.length >= 20) score += 15;
    if (data.rule_breaker.length >= 35) score += 15;
    if (data.staff_abuse.length >= 35) score += 15;
    if (data.why_admin.length >= 40) score += 15;
    if (data.why_choose.length >= 40) score += 15;
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, rating: "🟢 Strong Application", notes };
  if (score >= 55) return { score, rating: "🟡 Medium Application", notes };
  return { score, rating: "🔴 Weak Application", notes };
}

function appReviewButtons(type) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_accept_${type}`)
      .setLabel("Accept")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`app_deny_${type}`)
      .setLabel("Deny")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );
}

async function sendApplication(interaction, type, data) {
  const result = rateApplication(type, data);

  const title = type === "mm" ? "🛡️ New Middleman Application" : "👑 New Admin Application";
  const position = type === "mm" ? "Middleman" : "Admin";

  const embed = premiumEmbed(
    title,
    `${interaction.user} submitted an application for **${position}**.`,
    type === "mm" ? 0x5865f2 : 0xf1c40f
  ).addFields(
    { name: "👤 Discord Username", value: `${interaction.user}\n${interaction.user.username}`, inline: false }
  );

  if (type === "mm") {
    embed.addFields(
      { name: "🎂 Vouches", value: data.vouches || "None", inline: true },
      { name: "🌍 Timezone", value: data.timezone || "None", inline: true },
      { name: "⏰ Daily Activity", value: data.activity || "None", inline: false },
      { name: "📅 Time in Server", value: data.server_time || "None", inline: false },
      { name: "📱 Active When Needed?", value: data.active_needed || "None", inline: false },
      { name: "🤝 Previous MM Experience", value: data.experience || "None", inline: false },
      { name: "💬 Why Become MM?", value: data.why_mm || "None", inline: false },
      { name: "⭐ Why Choose Them?", value: data.why_choose || "None", inline: false }
    );
  }

  if (type === "admin") {
    embed.addFields(
      { name: "🎂 Age", value: data.age || "None", inline: true },
      { name: "🌍 Timezone", value: data.timezone || "None", inline: true },
      { name: "⏰ Daily Activity", value: data.activity || "None", inline: false },
      { name: "📅 Time in Server", value: data.server_time || "None", inline: false },
      { name: "🛡️ Staff Experience", value: data.staff_exp || "None", inline: false },
      { name: "📜 Rule Breaker Answer", value: data.rule_breaker || "None", inline: false },
      { name: "⚠️ Staff Abuse Answer", value: data.staff_abuse || "None", inline: false },
      { name: "💬 Why Admin?", value: data.why_admin || "None", inline: false },
      { name: "⭐ Why Choose Them?", value: data.why_choose || "None", inline: false }
    );
  }

  embed.addFields(
    {
      name: "📊 Bot Rating",
      value: `${result.rating}\nScore: **${result.score}/100**\n${result.notes.join("\n") || "No notes"}`,
      inline: false
    },
    {
      name: "📌 Status",
      value: "🟡 Waiting for Review",
      inline: false
    }
  );

  await interaction.channel.send({
    content: `<@&${MM_REVIEW_ROLE_ID}> New ${position} application!`,
    embeds: [embed],
    components: [appReviewButtons(type)]
  });

  return interaction.reply({
    content: "✅ Your application was submitted. Staff will review it soon.",
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
    .setTitle(type === "mm" ? "MM Vouch" : "Shop Vouch");

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

  const channelId = type === "mm" ? MM_VOUCH_CHANNEL_ID : BUYER_VOUCH_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId);

  const claimedId = ticketClaims.get(interaction.channel.id);
  const claimedUserText = claimedId ? `<@${claimedId}>` : "Not claimed";

  let title = "⭐ New Shop Vouch";
  let description = [
    `**Vouch this server and <@${OWNER_ID}>**`,
    "",
    text
  ].join("\n");

  if (type === "mm") {
    title = "🛡️ New MM Vouch";
    description = [
      `**Vouch for ${claimedUserText}**`,
      "",
      text
    ].join("\n");
  }

  const embed = premiumEmbed(
    title,
    description,
    type === "mm" ? 0x5865f2 : 0x2ecc71
  ).addFields(
    { name: "👤 Vouched By", value: `${interaction.user}\n${interaction.user.username}`, inline: true },
    { name: "⭐ Rating", value: `${rating}/5`, inline: true },
    { name: type === "mm" ? "🛡️ Claimed MM" : "🏪 Shop Owner", value: type === "mm" ? claimedUserText : `<@${OWNER_ID}>`, inline: false },
    { name: "🎫 Ticket", value: `${interaction.channel}`, inline: false }
  );

  await channel.send({
    content: type === "mm" && claimedId ? `<@${claimedId}> New MM vouch received!` : null,
    embeds: [embed]
  });

  vouchCompletedTickets.add(interaction.channel.id);

  return interaction.reply({
    content: `✅ Vouch sent to <#${channelId}>. Thank you!`,
    ephemeral: true
  });
}
// =======================
// SLASH COMMANDS
// =======================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the correct ticket panel"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("credit")
    .setDescription("Manage store credit")
    .addSubcommand(s =>
      s.setName("add")
        .setDescription("Add store credit")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .addNumberOption(o => o.setName("amount").setDescription("Amount").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("Remove store credit")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .addNumberOption(o => o.setName("amount").setDescription("Amount").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("check")
        .setDescription("Check store credit")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName("discount")
    .setDescription("Manage discount codes")
    .addSubcommand(s =>
      s.setName("create")
        .setDescription("Create a discount code")
    )
    .addSubcommand(s =>
      s.setName("list")
        .setDescription("List discount codes")
    ),

  new SlashCommandBuilder()
    .setName("addtoticket")
    .setDescription("Add user to ticket")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close this ticket")
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
// MAIN HANDLER
// =======================

client.on("interactionCreate", async interaction => {
  try {
    // =======================
    // SLASH COMMANDS
    // =======================

    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      if (cmd === "ping") {
        return interaction.reply({
          content: `🏓 Pong! ${client.ws.ping}ms`,
          ephemeral: true
        });
      }

      if (cmd === "panel") {
        if (isBuyerTicket(interaction.channel)) return interaction.reply(buyerPanel());
        if (isMMTicket(interaction.channel)) return interaction.reply(mmPanel());
        if (isMMApplyTicket(interaction.channel)) return interaction.reply(applicationPanel());

        return interaction.reply({
          content: "❌ This only works in buyer/MM/application tickets.",
          ephemeral: true
        });
      }

      if (cmd === "credit") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: denyFunny(), ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user") || interaction.user;

        if (sub === "add") {
          const amount = interaction.options.getNumber("amount");
          const balance = addCredit(user.id, amount);

          return interaction.reply({
            content: `✅ Added **${money(amount)}** store credit to ${user}.\nNew Balance: **${money(balance)}**`,
            ephemeral: true
          });
        }

        if (sub === "remove") {
          const amount = interaction.options.getNumber("amount");
          const balance = removeCredit(user.id, amount);

          return interaction.reply({
            content: `✅ Removed **${money(amount)}** store credit from ${user}.\nNew Balance: **${money(balance)}**`,
            ephemeral: true
          });
        }

        if (sub === "check") {
          const balance = getCredit(user.id);

          return interaction.reply({
            content: `🏦 ${user} has **${money(balance)}** store credit.`,
            ephemeral: true
          });
        }
      }

      if (cmd === "discount") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: denyFunny(), ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "create") {
          return discountCreateModal(interaction);
        }

        if (sub === "list") {
          if (discountCodes.size === 0) {
            return interaction.reply({
              content: "🎟️ No discount codes created yet.",
              ephemeral: true
            });
          }

          const list = [...discountCodes.values()]
            .map(c => {
              const amountText = c.type === "percent" ? `${c.amount}% off` : `${money(c.amount)} off`;
              return `• **${c.code}** — ${amountText} — Uses: **${c.used}/${c.maxUses}**`;
            })
            .join("\n");

          return interaction.reply({
            embeds: [premiumEmbed("🎟️ Discount Codes", list)],
            ephemeral: true
          });
        }
      }

      if (cmd === "addtoticket") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: denyFunny(), ephemeral: true });
        }

        const user = interaction.options.getUser("user");
        await addUserToTicket(interaction.channel, user.id);

        return interaction.reply(`✅ Added ${user} to this ticket.`);
      }

      if (cmd === "close") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: denyFunny(), ephemeral: true });
        }

        if (
          (isBuyerTicket(interaction.channel) || isMMTicket(interaction.channel)) &&
          !vouchCompletedTickets.has(interaction.channel.id) &&
          !isOwner(interaction.user.id)
        ) {
          return interaction.reply({
            content: "⭐ This ticket cannot be closed yet. A required vouch has not been submitted.",
            ephemeral: true
          });
        }

        await interaction.reply("🔒 Closing ticket in 5 seconds...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }
    }

    // =======================
    // BUTTONS
    // =======================

    if (interaction.isButton()) {
      if (interaction.customId === "buyer_start") {
        if (!isBuyerTicket(interaction.channel)) {
          return interaction.reply({ content: "❌ Buyer tickets only.", ephemeral: true });
        }

        return buyerCategoryMenu(interaction);
      }

      if (interaction.customId === "mm_start") {
        if (!isMMTicket(interaction.channel)) {
          return interaction.reply({ content: "❌ MM tickets only.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose trade size:",
          components: [mmSizeMenu()],
          ephemeral: true
        });
      }

      if (interaction.customId === "apply_start") {
        if (!isMMApplyTicket(interaction.channel)) {
          return interaction.reply({ content: "❌ Application tickets only.", ephemeral: true });
        }

        return interaction.reply({
          content: "What position do you want to apply for?",
          components: [applicationChoiceButtons()],
          ephemeral: true
        });
      }

      if (interaction.customId === "apply_mm") {
        return mmApplyModalPart1(interaction);
      }

      if (interaction.customId === "apply_admin") {
        return adminApplyModalPart1(interaction);
      }

      if (interaction.customId === "mm_apply_continue") {
        return mmApplyModalPart2(interaction);
      }

      if (interaction.customId === "admin_apply_continue") {
        return adminApplyModalPart2(interaction);
      }

      if (interaction.customId.startsWith("app_accept_")) {
        if (!staffOrOwner(interaction)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return interaction.reply(`✅ Application accepted by ${interaction.user}.`);
      }

      if (interaction.customId.startsWith("app_deny_")) {
        if (!staffOrOwner(interaction)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return interaction.reply(`❌ Application denied by ${interaction.user}.`);
      }

      if (interaction.customId === "order_claim") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        }

        if (ticketClaims.has(interaction.channel.id)) {
          return interaction.reply({
            content: `⚠️ This order is already claimed by <@${ticketClaims.get(interaction.channel.id)}>`,
            ephemeral: true
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        return interaction.reply(`🙋 Order claimed by ${interaction.user}`);
      }

      if (interaction.customId === "order_paid") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        }

        return interaction.reply("💳 Payment marked as received.");
      }

      if (interaction.customId === "order_done") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        }

        const sellerId = ticketClaims.get(interaction.channel.id);

        return interaction.reply({
          content: [
            "📦 Order delivered.",
            "",
            "⭐ **Vouch is required before this ticket can be closed.**",
            `Please vouch this server and <@${OWNER_ID}>.`,
            sellerId ? `Seller who claimed this ticket: <@${sellerId}>` : "Seller who claimed this ticket: Not claimed"
          ].join("\n"),
          components: [vouchButton("shop")]
        });
      }

      if (interaction.customId === "order_cancel") {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID) && !isOwner(interaction.user.id)) {
          return interaction.reply({ content: "❌ Sellers only.", ephemeral: true });
        }

        return interaction.reply("❌ Order cancelled.");
      }

      if (interaction.customId === "mm_claim") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        }

        if (ticketClaims.has(interaction.channel.id)) {
          return interaction.reply({
            content: `⚠️ This MM ticket is already claimed by <@${ticketClaims.get(interaction.channel.id)}>.\nNo fighting over tickets 😭`,
            ephemeral: true
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        return interaction.reply(`🛡️ MM ticket claimed by ${interaction.user}`);
      }

      if (interaction.customId === "mm_confirmed") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        }

        const mmId = ticketClaims.get(interaction.channel.id);

        return interaction.reply(
          mmId
            ? `✅ Both traders confirmed.\nClaimed MM: <@${mmId}>`
            : "✅ Both traders confirmed.\n⚠️ No MM has claimed this ticket yet."
        );
      }

      if (interaction.customId === "mm_done") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        }

        const mmId = ticketClaims.get(interaction.channel.id);

        return interaction.reply({
          content: [
            "📦 Trade completed.",
            "",
            "⭐ **MM vouch is required before this ticket can be closed.**",
            mmId ? `Please vouch the claimed MM: <@${mmId}>` : "No MM claimed this ticket yet.",
            "Click below to write the vouch."
          ].join("\n"),
          components: [vouchButton("mm")]
        });
      }

      if (interaction.customId === "mm_cancel") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: "❌ MM only.", ephemeral: true });
        }

        return interaction.reply("❌ MM request cancelled.");
      }

      if (interaction.customId === "vouch_shop") {
        return vouchModal(interaction, "shop");
      }

      if (interaction.customId === "vouch_mm") {
        return vouchModal(interaction, "mm");
      }
    }

    // =======================
    // SELECT MENUS
    // =======================

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "buyer_category") {
        return buyerItemMenu(interaction, interaction.values[0]);
      }

      if (interaction.customId.startsWith("buyer_item_")) {
        const category = interaction.customId.replace("buyer_item_", "");
        const itemName = interaction.values[0];

        if (itemName === "Other") {
          return buyerCustomOrderModal(interaction, category, "Custom Item", null);
        }

        return buyerCustomOrderModal(interaction, category, itemName, priceList[category][itemName]);
      }

      if (interaction.customId === "mm_size") {
        return mmTraderSelect(interaction, interaction.values[0]);
      }
    }

    if (interaction.isUserSelectMenu()) {
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

        return mmTradeModal(interaction, size, traderId);
      }
    }

    // =======================
    // MODALS
    // =======================

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "discount_create_modal") {
        if (!staffOrOwner(interaction)) {
          return interaction.reply({ content: denyFunny(), ephemeral: true });
        }

        const code = interaction.fields.getTextInputValue("code");
        const typeRaw = interaction.fields.getTextInputValue("type").toLowerCase().trim();
        const amount = Number(interaction.fields.getTextInputValue("amount"));
        const uses = Number(interaction.fields.getTextInputValue("uses"));

        const type = typeRaw.includes("percent") || typeRaw.includes("%") ? "percent" : "dollar";

        if (isNaN(amount) || amount <= 0 || isNaN(uses) || uses <= 0) {
          return interaction.reply({
            content: "❌ Invalid amount or uses.",
            ephemeral: true
          });
        }

        const created = createDiscountCode(code, type, amount, uses, interaction.user.id);

        return interaction.reply({
          content: `✅ Discount code **${created.code}** created.\nType: **${created.type}**\nAmount: **${created.type === "percent" ? `${created.amount}%` : money(created.amount)}**\nUses: **${created.maxUses}**`,
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith("buyer_order_")) {
        const parts = interaction.customId.split("_");
        const category = parts[2];
        const priceRaw = parts[3];
        const itemEncoded = parts.slice(4).join("_");

        let itemName = Buffer.from(itemEncoded, "base64").toString("utf8");
        const itemPrice = priceRaw === "custom" ? null : Number(priceRaw);

        if (itemName === "Custom Item") {
          itemName = interaction.fields.getTextInputValue("custom_item");
        }

        const amount = cleanAmount(interaction.fields.getTextInputValue("amount"));
        const payment = interaction.fields.getTextInputValue("payment");
        const discountCode = interaction.fields.getTextInputValue("discount") || "";
        const creditRaw = interaction.fields.getTextInputValue("credit") || "";
        const useCredit = creditRaw.toLowerCase().includes("yes");

        return sendOrderSummary(interaction, {
          category,
          item: itemName,
          price: itemPrice,
          amount,
          payment,
          discountCode,
          useCredit
        });
      }

      if (interaction.customId.startsWith("mm_trade_")) {
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

      if (interaction.customId === "mm_apply_part1") {
        mmApplications.set(interaction.user.id, {
          type: "mm",
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
        return sendApplication(interaction, "mm", fullData);
      }

      if (interaction.customId === "admin_apply_part1") {
        mmApplications.set(interaction.user.id, {
          type: "admin",
          age: interaction.fields.getTextInputValue("age"),
          timezone: interaction.fields.getTextInputValue("timezone"),
          activity: interaction.fields.getTextInputValue("activity"),
          server_time: interaction.fields.getTextInputValue("server_time"),
          staff_exp: interaction.fields.getTextInputValue("staff_exp")
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("admin_apply_continue")
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

      if (interaction.customId === "admin_apply_part2") {
        const part1 = mmApplications.get(interaction.user.id);

        if (!part1) {
          return interaction.reply({
            content: "❌ Please start the application again.",
            ephemeral: true
          });
        }

        const fullData = {
          ...part1,
          rule_breaker: interaction.fields.getTextInputValue("rule_breaker"),
          staff_abuse: interaction.fields.getTextInputValue("staff_abuse"),
          why_admin: interaction.fields.getTextInputValue("why_admin"),
          why_choose: interaction.fields.getTextInputValue("why_choose")
        };

        mmApplications.delete(interaction.user.id);
        return sendApplication(interaction, "admin", fullData);
      }

      if (interaction.customId === "vouch_modal_shop") {
        return sendVouch(interaction, "shop");
      }

      if (interaction.customId === "vouch_modal_mm") {
        return sendVouch(interaction, "mm");
      }
    }
  } catch (err) {
    console.log(err);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Something went wrong. Please tell staff.",
        ephemeral: true
      });
    }
  }
});

// =======================
// AUTO PANELS
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
        await channel.send(applicationPanel());
      }
    } catch (err) {
      console.log("Auto panel error:", err.message);
    }
  }, 2500);
});

// =======================
// READY / START
// =======================

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

registerCommands();
client.login(TOKEN);