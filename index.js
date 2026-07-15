
require("dotenv").config();

const fs = require("fs");
const path = require("path");
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
  Routes,
  PermissionFlagsBits
} = require("discord.js");

// ======================================================
// BLOOM BOT — ONE FILE VERSION
// ======================================================

// ----------------------
// WEB SERVER FOR RENDER
// ----------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.send("Bloom Bot is online.");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ----------------------
// ENV
// ----------------------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || "Ask the owner for the PayPal email.";
const SCAM_REPORT_CHANNEL_ID = process.env.SCAM_REPORT_CHANNEL_ID || "";
const SECURITY_LOG_CHANNEL_ID = process.env.SECURITY_LOG_CHANNEL_ID || "";

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ Missing TOKEN, CLIENT_ID, or GUILD_ID in .env");
  process.exit(1);
}

// ----------------------
// IMPORTANT IDS
// ----------------------
const OWNER_ID = "1442212943470264320";

const BUYER_CATEGORY_ID = "1524567770002489584";
const MM_CATEGORY_ID = "1524570656291688652";
const APPLICATION_CATEGORY_OR_CHANNEL_ID = "1524639852128374825";

const NEW_MM_ROLE_ID = "1523782888296939660";
const MM_ROLE_ID = "1516085004801802260";
const TRUSTED_MM_ROLE_ID = "1523783007842992238";
const SELLER_ROLE_ID = "1516085109378252810";
const REVIEW_ROLE_ID = "1516084407528722604";

const BUYER_VOUCH_CHANNEL_ID = "1516081257547825232";
const MM_VOUCH_CHANNEL_ID = "1523533160506327090";

// ----------------------
// CLIENT
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ======================================================
// SIMPLE JSON DATABASE
// ======================================================
const DATABASE_PATH = path.join(__dirname, "bloombot-data.json");

function defaultDatabase() {
  return {
    credits: {},
    discounts: {},
    carts: {},
    claims: {},
    orders: {},
    mmTickets: {},
    applications: {},
    applicationSettings: { open: true },
    vouchedTickets: [],
    warnings: {},
    blacklist: {},
    scamReports: [],
    orderHistory: {},
    orderCounter: 1000
  };
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DATABASE_PATH)) {
      const fresh = defaultDatabase();
      fs.writeFileSync(DATABASE_PATH, JSON.stringify(fresh, null, 2));
      return fresh;
    }

    const parsed = JSON.parse(fs.readFileSync(DATABASE_PATH, "utf8"));
    return {
      ...defaultDatabase(),
      ...parsed
    };
  } catch (error) {
    console.error("Database load error:", error);
    return defaultDatabase();
  }
}

let db = loadDatabase();

function saveDatabase() {
  try {
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Database save error:", error);
  }
}

function editDatabase(callback) {
  callback(db);
  saveDatabase();
}

// ======================================================
// PRICE LIST
// ======================================================
const priceList = {
  seeds: {
    "Carrot Seed": 0.10,
    "Strawberry Seed": 0.10,
    "Blueberry Seed": 0.10,
    "Tulip Seed": 0.10,
    "Tomato Seed": 0.10,
    "Apple Seed": 0.10,
    "Bamboo Seed": 0.10,
    "Corn Seed": 0.10,
    "Cactus Seed": 0.10,
    "Pineapple Seed": 0.10,
    "Mushroom Seed": 0.10,
    "Glow Mushroom Seed": 0.10,
    "Green Bean Seed": 0.10,
    "Banana Seed": 0.10,
    "Grape Seed": 0.10,
    "Coconut Seed": 0.10,
    "Mango Seed": 0.10,
    "Acorn Seed": 0.10,
    "Cherry Seed": 0.10,
    "Dragon Fruit Seed": 0.10,
    "Sunflower Seed": 0.10,
    "Venus Fly Trap Seed": 0.10,
    "Pomegranate Seed": 0.10,
    "Poison Ivy Seed": 0.10,
    "Poison Apple Seed": 0.10,
    "Baby Cactus Seed": 0.10,
    "Rocket Pop Seed": 0.10,

    "Mega Seed": 0.05,
    "Rainbow Seed": 0.05,
    "Gold Seed": 0.025,

    "Hypno Bloom Seed": 1 / 3,
    "Moon Bloom Seed": 1 / 3,

    "Ghost Pepper Seed": 0.50,
    "Dragon's Breath Seed": 0.50,
    "Venom Spitter Seed": 0.30
  },

  pets: {
    "Black Dragon": 69.00,
    "Raccoon": 3.00,
    "Golden Dragonfly": 1 / 3,
    "Unicorn": 1 / 3,
    "Ice Serpent": 55.00,
    "Bear": 1 / 3,
    "Bald Eagle": 1 / 3,
    "Butterfly": 2.00,
    "Bee": 0.10,
    "Big Bunny": 0.50,
    "Rainbow Bunny": 0.50,
    "Frog": 0.10,
    "Bunny": 0.10,
    "Owl": 0.10,
    "Deer": 0.10,
    "Robin": 0.10,
    "Turtle": 0.10
  }
};

// ======================================================
// HELPERS
// ======================================================
function isOwner(userId) {
  return userId === OWNER_ID;
}

function hasRole(interaction, roleId) {
  return Boolean(interaction.member?.roles?.cache?.has(roleId));
}

function isSeller(interaction) {
  return isOwner(interaction.user.id) || hasRole(interaction, SELLER_ROLE_ID);
}

function isAnyMM(interaction) {
  return (
    isOwner(interaction.user.id) ||
    hasRole(interaction, NEW_MM_ROLE_ID) ||
    hasRole(interaction, MM_ROLE_ID) ||
    hasRole(interaction, TRUSTED_MM_ROLE_ID)
  );
}

function isReviewer(interaction) {
  return isOwner(interaction.user.id) || hasRole(interaction, REVIEW_ROLE_ID);
}

function canModerate(interaction) {
  return (
    isOwner(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
  );
}

function canBan(interaction) {
  return (
    isOwner(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)
  );
}

function canKick(interaction) {
  return (
    isOwner(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)
  );
}

function applicationIsOpen() {
  return db.applicationSettings?.open !== false;
}

async function sendSecurityLog(embed) {
  if (!SECURITY_LOG_CHANNEL_ID) return;
  const channel = await client.channels.fetch(SECURITY_LOG_CHANNEL_ID).catch(() => null);
  if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
}

function isBuyerTicket(channel) {
  return channel?.parentId === BUYER_CATEGORY_ID;
}

function isMMTicket(channel) {
  return channel?.parentId === MM_CATEGORY_ID;
}

function isApplicationTicket(channel) {
  return (
    channel?.id === APPLICATION_CATEGORY_OR_CHANNEL_ID ||
    channel?.parentId === APPLICATION_CATEGORY_OR_CHANNEL_ID
  );
}

function money(number) {
  return `$${Number(number || 0).toFixed(2)}`;
}

function premiumEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Bloom Bot • Secure Shop & Middleman" });
}

function ephemeral(content) {
  return {
    content,
    ephemeral: true
  };
}

function safeWholeNumber(raw, min = 1, max = 100000) {
  const number = Number(raw);

  if (!Number.isInteger(number)) return null;
  if (number < min || number > max) return null;

  return number;
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
  } catch (error) {
    console.error("Add user error:", error);
    return false;
  }
}

function getClaim(channelId) {
  return db.claims[channelId] || null;
}

function setClaim(channelId, userId, type) {
  editDatabase(database => {
    database.claims[channelId] = {
      userId,
      type,
      claimedAt: Date.now()
    };
  });
}

function removeClaim(channelId) {
  editDatabase(database => {
    delete database.claims[channelId];

    if (database.mmTickets[channelId]) {
      database.mmTickets[channelId].claimedBy = null;
      database.mmTickets[channelId].claimedAt = null;
    }
  });
}

function claimedByOrOwner(interaction, claim) {
  return isOwner(interaction.user.id) || claim?.userId === interaction.user.id;
}

// ======================================================
// CREDIT SYSTEM
// ======================================================
function getCredit(userId) {
  return Number(db.credits[userId] || 0);
}

function setCredit(userId, amount) {
  const cleanAmount = Math.max(0, Number(amount || 0));

  editDatabase(database => {
    database.credits[userId] = cleanAmount;
  });

  return getCredit(userId);
}

function addCredit(userId, amount) {
  return setCredit(userId, getCredit(userId) + Number(amount || 0));
}

function removeCredit(userId, amount) {
  return setCredit(userId, getCredit(userId) - Number(amount || 0));
}

// ======================================================
// DISCOUNT SYSTEM
// ======================================================
function createDiscountCode({
  code,
  type,
  amount,
  maxUses,
  perUserLimit,
  createdBy
}) {
  const cleanCode = code.toUpperCase().trim();

  const data = {
    code: cleanCode,
    type,
    amount: Number(amount),
    maxUses: Number(maxUses),
    perUserLimit: Number(perUserLimit),
    used: 0,
    users: {},
    active: true,
    createdBy,
    createdAt: Date.now()
  };

  editDatabase(database => {
    database.discounts[cleanCode] = data;
  });

  return data;
}

function getDiscountCode(code) {
  if (!code) return null;

  return db.discounts[code.toUpperCase().trim()] || null;
}

function canUseDiscount(codeData, userId) {
  if (!codeData) return false;
  if (!codeData.active) return false;
  if (codeData.used >= codeData.maxUses) return false;

  const usedByUser = Number(codeData.users?.[userId] || 0);

  return usedByUser < Number(codeData.perUserLimit || 1);
}

function calculateDiscount(total, codeData, userId) {
  if (!canUseDiscount(codeData, userId)) return 0;

  if (codeData.type === "percent") {
    return Math.min(total, total * (codeData.amount / 100));
  }

  return Math.min(total, codeData.amount);
}

function consumeDiscount(code, userId) {
  const cleanCode = code.toUpperCase().trim();

  editDatabase(database => {
    const discount = database.discounts[cleanCode];

    if (!discount) return;

    discount.used += 1;
    discount.users[userId] = Number(discount.users[userId] || 0) + 1;
  });
}

// ======================================================
// SHOP CART SYSTEM
// ======================================================
function getCart(userId) {
  return db.carts[userId] || [];
}

function saveCart(userId, cart) {
  editDatabase(database => {
    database.carts[userId] = cart;
  });
}

function clearCart(userId) {
  saveCart(userId, []);
}

function addToCart(userId, category, itemName, quantity) {
  const cart = [...getCart(userId)];

  const existing = cart.find(item => {
    return item.category === category && item.name === itemName;
  });

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      category,
      name: itemName,
      quantity,
      unitPrice: priceList[category][itemName]
    });
  }

  saveCart(userId, cart);
}

function removeCartItem(userId, index) {
  const cart = [...getCart(userId)];

  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
  }

  saveCart(userId, cart);
}

function calculateCartSubtotal(cart) {
  return cart.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);
}

function shopPanel() {
  const embed = premiumEmbed(
    "🛒 Bloom Shop",
    [
      "Build one order with **multiple seeds and pets**.",
      "",
      "✅ Add as many items as you need",
      "✅ Mix seeds and pets in the same order",
      "✅ Automatic total calculation",
      "✅ Discount codes",
      "✅ Store credit",
      "✅ PayPal only",
      "✅ Required vouch after delivery"
    ].join("\n"),
    0x2ecc71
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("shop_add_seed")
      .setLabel("Add Seed")
      .setEmoji("🌱")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("shop_add_pet")
      .setLabel("Add Pet")
      .setEmoji("🐾")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("shop_view_cart")
      .setLabel("View Cart")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("shop_clear_cart")
      .setLabel("Clear Cart")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function shopItemMenu(category, page = 0) {
  const allItems = Object.keys(priceList[category]);
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const start = safePage * pageSize;
  const pageItems = allItems.slice(start, start + pageSize);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`shop_pick_${category}_${safePage}`)
    .setPlaceholder(
      category === "seeds" ? "Choose a seed" : "Choose a pet"
    )
    .addOptions(
      pageItems.map(itemName => ({
        label: itemName.slice(0, 100),
        value: itemName,
        description: `${money(priceList[category][itemName])} each`
      }))
    );

  const rows = [
    new ActionRowBuilder().addComponents(select)
  ];

  const navigationRow = new ActionRowBuilder();

  if (safePage > 0) {
    navigationRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_page_${category}_${safePage - 1}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (safePage < totalPages - 1) {
    navigationRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_page_${category}_${safePage + 1}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (navigationRow.components.length > 0) {
    rows.push(navigationRow);
  }

  return {
    content: `Page ${safePage + 1}/${totalPages}`,
    components: rows,
    ephemeral: true
  };
}

function quantityModal(category, itemName) {
  const encodedName = Buffer.from(itemName, "utf8").toString("base64");

  const modal = new ModalBuilder()
    .setCustomId(`shop_quantity_${category}_${encodedName}`)
    .setTitle("Add Item");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("quantity")
        .setLabel("Quantity")
        .setPlaceholder("Example: 1, 5, 20")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

function buildCartEmbed(userId) {
  const cart = getCart(userId);

  if (cart.length === 0) {
    return premiumEmbed(
      "🛒 Your Cart",
      "Your cart is empty.",
      0xf1c40f
    );
  }

  const seedLines = [];
  const petLines = [];

  cart.forEach((item, index) => {
    const line = `**${index + 1}.** ${item.name} ×${item.quantity} — ${money(item.unitPrice * item.quantity)}`;

    if (item.category === "seeds") {
      seedLines.push(line);
    } else {
      petLines.push(line);
    }
  });

  const sections = [];

  if (seedLines.length > 0) {
    sections.push(`**🌱 Seeds**\n${seedLines.join("\n")}`);
  }

  if (petLines.length > 0) {
    sections.push(`**🐾 Pets**\n${petLines.join("\n")}`);
  }

  sections.push(
    `\n**Subtotal: ${money(calculateCartSubtotal(cart))}**`
  );

  return premiumEmbed(
    "🛒 Your Cart",
    sections.join("\n\n"),
    0x2ecc71
  );
}

function cartButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("shop_remove_item")
      .setLabel("Remove Item")
      .setEmoji("➖")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("shop_checkout")
      .setLabel("Checkout")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("shop_clear_cart")
      .setLabel("Clear")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );
}

function removeItemMenu(userId) {
  const cart = getCart(userId);

  const select = new StringSelectMenuBuilder()
    .setCustomId("shop_remove_select")
    .setPlaceholder("Choose an item to remove")
    .addOptions(
      cart.slice(0, 25).map((item, index) => ({
        label: `${item.name} ×${item.quantity}`.slice(0, 100),
        value: String(index),
        description: money(item.unitPrice * item.quantity)
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

function checkoutModal() {
  const modal = new ModalBuilder()
    .setCustomId("shop_checkout_modal")
    .setTitle("Checkout");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("discount")
        .setLabel("Discount code")
        .setPlaceholder("Optional")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("credit")
        .setLabel("Use store credit?")
        .setPlaceholder("yes or no")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  return modal;
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

async function createOrderFromCart(interaction) {
  const cart = getCart(interaction.user.id);

  if (cart.length === 0) {
    return interaction.reply(ephemeral("❌ Your cart is empty."));
  }

  const discountCode = (
    interaction.fields.getTextInputValue("discount") || ""
  ).trim().toUpperCase();

  const useCredit = (
    interaction.fields.getTextInputValue("credit") || ""
  ).toLowerCase().includes("yes");

  const subtotal = calculateCartSubtotal(cart);
  const discountData = getDiscountCode(discountCode);
  const discountAmount = calculateDiscount(
    subtotal,
    discountData,
    interaction.user.id
  );

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const creditUsed = useCredit
    ? Math.min(getCredit(interaction.user.id), afterDiscount)
    : 0;

  const finalTotal = Math.max(0, afterDiscount - creditUsed);

  if (discountAmount > 0) {
    consumeDiscount(discountCode, interaction.user.id);
  }

  if (creditUsed > 0) {
    removeCredit(interaction.user.id, creditUsed);
  }

  let orderId;

  editDatabase(database => {
    database.orderCounter += 1;
    orderId = database.orderCounter;

    database.orders[interaction.channel.id] = {
      orderId,
      buyerId: interaction.user.id,
      items: cart,
      subtotal,
      discountCode,
      discountAmount,
      creditUsed,
      finalTotal,
      status: "waiting_for_seller",
      createdAt: Date.now()
    };

    database.carts[interaction.user.id] = [];
  });

  const itemLines = cart
    .map(item => {
      return `${item.name} ×${item.quantity} — ${money(item.unitPrice * item.quantity)}`;
    })
    .join("\n");

  const embed = premiumEmbed(
    `🛒 Order #${orderId}`,
    "A seller must claim this order before helping.",
    0x2ecc71
  ).addFields(
    {
      name: "👤 Buyer",
      value: `${interaction.user}\n${interaction.user.username}`,
      inline: false
    },
    {
      name: "📦 Items",
      value: itemLines.slice(0, 1024),
      inline: false
    },
    {
      name: "💵 Subtotal",
      value: money(subtotal),
      inline: true
    },
    {
      name: "🎟️ Discount",
      value: `-${money(discountAmount)}`,
      inline: true
    },
    {
      name: "🏦 Store Credit",
      value: `-${money(creditUsed)}`,
      inline: true
    },
    {
      name: "💰 Final Total",
      value: money(finalTotal),
      inline: false
    },
    {
      name: "💳 Payment",
      value: `PayPal only\n${PAYPAL_EMAIL}`,
      inline: false
    },
    {
      name: "📌 Status",
      value: "🟡 Waiting for Seller",
      inline: false
    }
  );

  await interaction.channel.send({
    content: `<@&${SELLER_ROLE_ID}> New order waiting!`,
    embeds: [embed],
    components: [orderButtons()]
  });

  return interaction.reply(
    ephemeral("✅ Order created. A seller will help you soon.")
  );
}

// ======================================================
// MM SYSTEM
// ======================================================
function mmPanel() {
  const embed = premiumEmbed(
    "🛡️ Middleman Ticket",
    [
      "Create a secure trade request.",
      "",
      "✅ Correct MM tier only",
      "✅ One MM claim only",
      "✅ Nobody can cut over another MM",
      "✅ MM fees are **in-game items only**",
      "✅ Owner can override any claim",
      "✅ Required MM vouch"
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

  return {
    embeds: [embed],
    components: [row]
  };
}

function mmSizeMenu() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("mm_size")
    .setPlaceholder("Choose trade size")
    .addOptions(
      {
        label: "Small Trade",
        value: "small",
        emoji: "🔹",
        description: "New MM"
      },
      {
        label: "Normal Trade",
        value: "normal",
        emoji: "🔸",
        description: "MM"
      },
      {
        label: "Huge Trade",
        value: "huge",
        emoji: "🔶",
        description: "Trusted MM"
      }
    );

  return new ActionRowBuilder().addComponents(select);
}

function mmTraderMenu(size) {
  const select = new UserSelectMenuBuilder()
    .setCustomId(`mm_trader_${size}`)
    .setPlaceholder("Select the other trader")
    .setMinValues(1)
    .setMaxValues(1);

  return new ActionRowBuilder().addComponents(select);
}

function mmDetailsModal(size, traderId) {
  const modal = new ModalBuilder()
    .setCustomId(`mm_details_${size}_${traderId}`)
    .setTitle("MM Trade Details");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives1")
        .setLabel("Trader 1 store items")
        .setPlaceholder("Example: 20 Mega Seed, 3 Unicorn")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives2")
        .setLabel("Trader 2 store items")
        .setPlaceholder("Example: 2 Raccoon, 10 Gold Seed")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

function parseStoreItems(raw) {
  const entries = String(raw || "")
    .split(/[\n,;+]+/)
    .map(x => x.trim())
    .filter(Boolean);

  const store = [
    ...Object.entries(priceList.seeds),
    ...Object.entries(priceList.pets)
  ].sort((a, b) => b[0].length - a[0].length);

  const items = [];
  const unknown = [];

  for (const entry of entries) {
    const lower = entry.toLowerCase().replace(/[’']/g, "'");
    const found = store.find(([name]) => {
      const full = name.toLowerCase().replace(/[’']/g, "'");
      const noSeed = full.replace(/\s+seed$/, "");
      return lower.includes(full) || lower.includes(noSeed);
    });

    if (!found) {
      unknown.push(entry);
      continue;
    }

    const quantityMatch = entry.match(/\d+/);
    const quantity = quantityMatch ? Number(quantityMatch[0]) : 1;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      unknown.push(entry);
      continue;
    }

    const [name, unitPrice] = found;
    items.push({
      name,
      quantity,
      unitPrice,
      total: unitPrice * quantity
    });
  }

  return {
    items,
    unknown,
    total: items.reduce((sum, item) => sum + item.total, 0)
  };
}

function formatParsedItems(items) {
  return items
    .map(item => `• **${item.name} ×${item.quantity}** — ${money(item.total)}`)
    .join("\n");
}

function mmTierFromValue(value) {
  if (value >= 25) {
    return {
      size: "huge",
      roleId: TRUSTED_MM_ROLE_ID,
      roleName: "Trusted MM",
      feePercent: 20
    };
  }

  if (value >= 5) {
    return {
      size: "normal",
      roleId: MM_ROLE_ID,
      roleName: "MM",
      feePercent: 20
    };
  }

  return {
    size: "small",
    roleId: NEW_MM_ROLE_ID,
    roleName: "New MM",
    feePercent: 5
  };
}

function mmRoleForSize(size) {
  if (size === "huge") {
    return {
      roleId: TRUSTED_MM_ROLE_ID,
      roleName: "Trusted MM"
    };
  }

  if (size === "normal") {
    return {
      roleId: MM_ROLE_ID,
      roleName: "MM"
    };
  }

  return {
    roleId: NEW_MM_ROLE_ID,
    roleName: "New MM"
  };
}

function mmActionButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mm_claim")
        .setLabel("Claim MM")
        .setEmoji("🛡️")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("mm_cancel")
        .setLabel("Cancel")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function mmConfirmationButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_confirm_trader1")
      .setLabel("Trader 1 Confirm")
      .setEmoji("1️⃣")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_confirm_trader2")
      .setLabel("Trader 2 Confirm")
      .setEmoji("2️⃣")
      .setStyle(ButtonStyle.Success)
  );
}

function mmControlButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_fee")
      .setLabel("Set Fee Items")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("mm_fee_paid")
      .setLabel("Fee Received")
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

function mmFeeModal() {
  const modal = new ModalBuilder()
    .setCustomId("mm_fee_modal")
    .setTitle("MM Item Fee");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("items")
        .setLabel("In-game items required")
        .setPlaceholder("Example: 2 Unicorns or 20 Mega Seeds")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("payer")
        .setLabel("Who pays the fee?")
        .setPlaceholder("Trader 1, Trader 2, or split")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

// ======================================================
// APPLICATION SYSTEM
// ======================================================
function applicationPanel() {
  const embed = premiumEmbed(
    "📝 Staff Applications",
    [
      "Choose what you want to apply for.",
      "",
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

  return {
    embeds: [embed],
    components: [row]
  };
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

function mmApplicationPart1Modal() {
  const modal = new ModalBuilder()
    .setCustomId("mm_apply_part1")
    .setTitle("MM Application Part 1");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("vouches")
        .setLabel("How many vouches do you have?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("timezone")
        .setLabel("Timezone")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("activity")
        .setLabel("Daily activity")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("server_time")
        .setLabel("How long have you been in the server?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("available")
        .setLabel("Can you be active when needed?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

function mmApplicationPart2Modal() {
  const modal = new ModalBuilder()
    .setCustomId("mm_apply_part2")
    .setTitle("MM Application Part 2");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("experience")
        .setLabel("Previous MM experience?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("why")
        .setLabel("Why do you want to become MM?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("choose")
        .setLabel("Why should we choose you?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

function adminApplicationPart1Modal() {
  const modal = new ModalBuilder()
    .setCustomId("admin_apply_part1")
    .setTitle("Admin Application Part 1");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("age")
        .setLabel("Age")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("timezone")
        .setLabel("Timezone")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("activity")
        .setLabel("Daily activity")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("server_time")
        .setLabel("How long have you been in the server?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("experience")
        .setLabel("Previous staff experience?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

function adminApplicationPart2Modal() {
  const modal = new ModalBuilder()
    .setCustomId("admin_apply_part2")
    .setTitle("Admin Application Part 2");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rule")
        .setLabel("What if someone breaks the rules?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("abuse")
        .setLabel("What if a staff member abuses power?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("why")
        .setLabel("Why do you want admin?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("choose")
        .setLabel("Why should we choose you?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

function scoreApplication(type, data) {
  let score = 0;
  const notes = [];

  if (type === "mm") {
    const vouches = parseInt(
      String(data.vouches || "").replace(/\D/g, "")
    ) || 0;

    if (vouches >= 25) {
      score += 30;
      notes.push("✅ Strong vouch count");
    } else if (vouches >= 10) {
      score += 20;
      notes.push("🟡 Decent vouch count");
    } else {
      score += 5;
      notes.push("⚠️ Low vouch count");
    }

    if (data.available.toLowerCase().includes("yes")) score += 15;
    if (data.activity.length >= 5) score += 10;
    if (data.server_time.length >= 4) score += 10;
    if (data.experience.length >= 20) score += 15;
    if (data.why.length >= 30) score += 10;
    if (data.choose.length >= 30) score += 10;
  }

  if (type === "admin") {
    const age = parseInt(
      String(data.age || "").replace(/\D/g, "")
    ) || 0;

    if (age >= 14) {
      score += 15;
      notes.push("✅ Mature age range");
    } else if (age >= 12) {
      score += 8;
      notes.push("🟡 Young, but possible");
    } else {
      score += 2;
      notes.push("⚠️ Very young for admin");
    }

    if (data.activity.length >= 5) score += 10;
    if (data.server_time.length >= 4) score += 10;
    if (data.experience.length >= 20) score += 15;
    if (data.rule.length >= 30) score += 15;
    if (data.abuse.length >= 30) score += 15;
    if (data.why.length >= 30) score += 10;
    if (data.choose.length >= 30) score += 10;
  }

  score = Math.min(100, Math.max(0, score));

  let rating = "🔴 Weak Application";

  if (score >= 80) {
    rating = "🟢 Strong Application";
  } else if (score >= 55) {
    rating = "🟡 Medium Application";
  }

  return {
    score,
    rating,
    notes
  };
}

function applicationReviewButtons(type) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`application_accept_${type}`)
      .setLabel("Accept")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`application_deny_${type}`)
      .setLabel("Deny")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );
}

async function sendApplication(interaction, type, data) {
  const result = scoreApplication(type, data);

  const embed = premiumEmbed(
    type === "mm"
      ? "🛡️ New Middleman Application"
      : "👑 New Admin Application",
    `${interaction.user} submitted an application.`,
    type === "mm" ? 0x5865f2 : 0xf1c40f
  );

  embed.addFields(
    {
      name: "👤 Applicant",
      value: `${interaction.user}\n${interaction.user.username}`,
      inline: false
    }
  );

  if (type === "mm") {
    embed.addFields(
      {
        name: "Vouches",
        value: data.vouches,
        inline: true
      },
      {
        name: "Timezone",
        value: data.timezone,
        inline: true
      },
      {
        name: "Activity",
        value: data.activity,
        inline: false
      },
      {
        name: "Time in Server",
        value: data.server_time,
        inline: false
      },
      {
        name: "Available?",
        value: data.available,
        inline: false
      },
      {
        name: "Experience",
        value: data.experience,
        inline: false
      },
      {
        name: "Why MM?",
        value: data.why,
        inline: false
      },
      {
        name: "Why Choose Them?",
        value: data.choose,
        inline: false
      }
    );
  } else {
    embed.addFields(
      {
        name: "Age",
        value: data.age,
        inline: true
      },
      {
        name: "Timezone",
        value: data.timezone,
        inline: true
      },
      {
        name: "Activity",
        value: data.activity,
        inline: false
      },
      {
        name: "Time in Server",
        value: data.server_time,
        inline: false
      },
      {
        name: "Experience",
        value: data.experience,
        inline: false
      },
      {
        name: "Rule Breaker Answer",
        value: data.rule,
        inline: false
      },
      {
        name: "Staff Abuse Answer",
        value: data.abuse,
        inline: false
      },
      {
        name: "Why Admin?",
        value: data.why,
        inline: false
      },
      {
        name: "Why Choose Them?",
        value: data.choose,
        inline: false
      }
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
    content: `<@&${REVIEW_ROLE_ID}> New application!`,
    embeds: [embed],
    components: [applicationReviewButtons(type)]
  });

  return interaction.reply(
    ephemeral("✅ Application submitted.")
  );
}

// ======================================================
// VOUCH SYSTEM
// ======================================================
function vouchModal(type) {
  const modal = new ModalBuilder()
    .setCustomId(`vouch_modal_${type}`)
    .setTitle(type === "mm" ? "MM Vouch" : "Shop Vouch");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rating")
        .setLabel("Rating from 1 to 5")
        .setPlaceholder("5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("items")
        .setLabel("Items bought or traded")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("comment")
        .setLabel("Your honest vouch")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("proof")
        .setLabel("Proof link or uploaded in ticket")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

async function submitVouch(interaction, type) {
  const rating = safeWholeNumber(
    interaction.fields.getTextInputValue("rating"),
    1,
    5
  );

  if (!rating) {
    return interaction.reply(
      ephemeral("❌ Rating must be a whole number from 1 to 5.")
    );
  }

  const items = interaction.fields.getTextInputValue("items");
  const comment = interaction.fields.getTextInputValue("comment");
  const proof = interaction.fields.getTextInputValue("proof");

  const targetChannelId = type === "mm"
    ? MM_VOUCH_CHANNEL_ID
    : BUYER_VOUCH_CHANNEL_ID;

  const targetChannel = await client.channels.fetch(targetChannelId);
  const claim = getClaim(interaction.channel.id);

  const embed = premiumEmbed(
    type === "mm" ? "🛡️ New MM Vouch" : "⭐ New Shop Vouch",
    comment,
    type === "mm" ? 0x5865f2 : 0x2ecc71
  ).addFields(
    {
      name: "👤 Vouched By",
      value: `${interaction.user}\n${interaction.user.username}`,
      inline: true
    },
    {
      name: "⭐ Rating",
      value: `${"⭐".repeat(rating)} (${rating}/5)`,
      inline: true
    },
    {
      name: "📦 Items",
      value: items,
      inline: false
    },
    {
      name: type === "mm" ? "🛡️ Claimed MM" : "👑 Shop Owner",
      value: type === "mm"
        ? claim
          ? `<@${claim.userId}>`
          : "No claimed MM"
        : `<@${OWNER_ID}>`,
      inline: false
    },
    {
      name: "🖼️ Proof",
      value: proof,
      inline: false
    },
    {
      name: "🎫 Ticket",
      value: `${interaction.channel}`,
      inline: false
    }
  );

  await targetChannel.send({
    content:
      type === "mm" && claim
        ? `<@${claim.userId}> New MM vouch!`
        : null,
    embeds: [embed]
  });

  editDatabase(database => {
    if (!database.vouchedTickets.includes(interaction.channel.id)) {
      database.vouchedTickets.push(interaction.channel.id);
    }
  });

  return interaction.reply(
    ephemeral(`✅ Vouch posted in <#${targetChannelId}>.`)
  );
}

// ======================================================
// OWNER MODALS
// ======================================================
function discountCreateModal() {
  const modal = new ModalBuilder()
    .setCustomId("owner_discount_create")
    .setTitle("Create Discount Code");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("code")
        .setLabel("Discount code")
        .setPlaceholder("SAVE10")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("type")
        .setLabel("Type: percent or dollar")
        .setPlaceholder("percent")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Amount")
        .setPlaceholder("10")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("uses")
        .setLabel("Total uses")
        .setPlaceholder("100")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("peruser")
        .setLabel("Uses per user")
        .setPlaceholder("1")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}


// ======================================================
// SECURITY, SCAM REPORTS, WARNINGS, AND USEFUL COMMANDS
// ======================================================
function userWarnings(userId) {
  return db.warnings[userId] || [];
}

function addWarning(userId, moderatorId, reason) {
  editDatabase(database => {
    if (!database.warnings[userId]) database.warnings[userId] = [];
    database.warnings[userId].push({
      moderatorId,
      reason,
      createdAt: Date.now()
    });
  });
}

function clearWarnings(userId) {
  editDatabase(database => {
    database.warnings[userId] = [];
  });
}

function blacklistUser(userId, moderatorId, reason) {
  editDatabase(database => {
    database.blacklist[userId] = {
      moderatorId,
      reason,
      createdAt: Date.now()
    };
  });
}

function unblacklistUser(userId) {
  editDatabase(database => {
    delete database.blacklist[userId];
  });
}

function pricesEmbed(category) {
  const entries = Object.entries(priceList[category]);
  const lines = entries.map(([name, price]) => `• **${name}** — ${money(price)}`);
  const chunks = [];
  while (lines.length) chunks.push(lines.splice(0, 20).join("\\n"));

  const embed = premiumEmbed(
    category === "seeds" ? "🌱 Seed Prices" : "🐾 Pet Prices",
    chunks.shift() || "No prices found.",
    category === "seeds" ? 0x2ecc71 : 0x5865f2
  );

  chunks.forEach((chunk, index) => {
    embed.addFields({ name: `More ${category} ${index + 1}`, value: chunk });
  });

  return embed;
}

function helpEmbed() {
  return premiumEmbed(
    "📘 Bloom Bot Help",
    [
      "**Buying**",
      "1. Open a purchase ticket.",
      "2. Press **Add Seed** or **Add Pet**.",
      "3. Choose an item and quantity.",
      "4. Press **Checkout**.",
      "",
      "**Middleman**",
      "1. Open an MM ticket.",
      "2. Add the other trader.",
      "3. Enter the trade and its value.",
      "4. Both traders must confirm.",
      "5. An MM claims it and checks the fee.",
      "",
      "**Useful commands**",
      "`/prices` `/cart` `/orderstatus` `/mmstatus` `/history` `/scammercheck` `/reportscammer`"
    ].join("\\n"),
    0x3498db
  );
}

// ======================================================
// SLASH COMMANDS
// ======================================================
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the correct ticket panel"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("addtoticket")
    .setDescription("Staff/MM/owner: add a user to the ticket")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to add")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close this ticket after a vouch"),

  new SlashCommandBuilder()
    .setName("credit")
    .setDescription("Owner only: manage store credit")
    .addSubcommand(subcommand =>
      subcommand
        .setName("add")
        .setDescription("Add store credit")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User")
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Amount")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("Remove store credit")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User")
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Amount")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("set")
        .setDescription("Set exact store credit")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User")
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Amount")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("check")
        .setDescription("Check store credit")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User")
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName("discount")
    .setDescription("Owner only: manage discount codes")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create a discount code")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List discount codes")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("disable")
        .setDescription("Disable a discount code")
        .addStringOption(option =>
          option
            .setName("code")
            .setDescription("Discount code")
            .setRequired(true)
        )
    ),


  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Show the shop panel"),

  new SlashCommandBuilder()
    .setName("cart")
    .setDescription("Show your current cart"),

  new SlashCommandBuilder()
    .setName("prices")
    .setDescription("Show seed or pet prices")
    .addStringOption(option =>
      option.setName("category").setDescription("Choose a category").setRequired(true)
        .addChoices(
          { name: "Seeds", value: "seeds" },
          { name: "Pets", value: "pets" }
        )
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show simple bot instructions"),

  new SlashCommandBuilder()
    .setName("orderstatus")
    .setDescription("Show this ticket's order status"),

  new SlashCommandBuilder()
    .setName("mmstatus")
    .setDescription("Show this ticket's MM status"),

  new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show your completed order history"),

  new SlashCommandBuilder()
    .setName("reportscammer")
    .setDescription("Report a possible scammer with proof")
    .addUserOption(option => option.setName("user").setDescription("User being reported").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("What happened?").setRequired(true))
    .addStringOption(option => option.setName("proof").setDescription("Proof link or message link").setRequired(true)),

  new SlashCommandBuilder()
    .setName("scammercheck")
    .setDescription("Check warnings and blacklist status")
    .addUserOption(option => option.setName("user").setDescription("User to check").setRequired(true)),

  new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Owner only: manage the scammer blacklist")
    .addSubcommand(sub => sub.setName("add").setDescription("Add a user")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
      .addStringOption(option => option.setName("reason").setDescription("Reason").setRequired(true)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Remove a user")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("List blacklisted users")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Moderation warning commands")
    .addSubcommand(sub => sub.setName("add").setDescription("Warn a user")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
      .addStringOption(option => option.setName("reason").setDescription("Reason").setRequired(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("View warnings")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand(sub => sub.setName("clear").setDescription("Clear warnings")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(option => option.setName("minutes").setDescription("Minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(option => option.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Owner only: lock or unlock the current channel")
    .addStringOption(option => option.setName("mode").setDescription("Mode").setRequired(true)
      .addChoices({ name: "Lock", value: "lock" }, { name: "Unlock", value: "unlock" })),

  new SlashCommandBuilder()
    .setName("applications")
    .setDescription("Owner only: open, close, or check applications")
    .addStringOption(option => option.setName("mode").setDescription("Mode").setRequired(true)
      .addChoices(
        { name: "Open", value: "open" },
        { name: "Close", value: "close" },
        { name: "Status", value: "status" }
      )),

  new SlashCommandBuilder()
    .setName("owner")
    .setDescription("Owner override commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("unclaim")
        .setDescription("Remove the claim from this ticket")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("forcecomplete")
        .setDescription("Force-complete this ticket")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("forceclose")
        .setDescription("Force-close this ticket")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("transferclaim")
        .setDescription("Transfer the claim to another user")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("New claimed user")
            .setRequired(true)
        )
    )
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    {
      body: commands
    }
  );

  console.log("✅ Slash commands registered.");
}

// ======================================================
// MAIN INTERACTION HANDLER
// ======================================================
client.on("interactionCreate", async interaction => {
  try {
    // ----------------------
    // SLASH COMMANDS
    // ----------------------
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;

      if (commandName === "ping") {
        return interaction.reply(
          ephemeral(`🏓 Pong! ${client.ws.ping}ms`)
        );
      }

      if (commandName === "shop") {
        return interaction.reply(shopPanel());
      }

      if (commandName === "cart") {
        return interaction.reply({
          embeds: [buildCartEmbed(interaction.user.id)],
          components: [cartButtons()],
          ephemeral: true
        });
      }

      if (commandName === "prices") {
        const category = interaction.options.getString("category");
        return interaction.reply({ embeds: [pricesEmbed(category)], ephemeral: true });
      }

      if (commandName === "help") {
        return interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
      }

      if (commandName === "orderstatus") {
        const order = db.orders[interaction.channel.id];
        if (!order) return interaction.reply(ephemeral("❌ No order exists in this ticket."));
        return interaction.reply({
          embeds: [premiumEmbed(
            `🧾 Order #${order.orderId}`,
            `**Status:** ${order.status}\\n**Buyer:** <@${order.buyerId}>\\n**Total:** ${money(order.finalTotal)}`
          )],
          ephemeral: true
        });
      }

      if (commandName === "mmstatus") {
        const ticket = db.mmTickets[interaction.channel.id];
        if (!ticket) return interaction.reply(ephemeral("❌ No MM request exists here."));
        return interaction.reply({
          embeds: [premiumEmbed(
            "🛡️ MM Status",
            [
              `Trader 1: <@${ticket.trader1Id}> ${ticket.trader1Confirmed ? "✅" : "⏳"}`,
              `Trader 2: <@${ticket.trader2Id}> ${ticket.trader2Confirmed ? "✅" : "⏳"}`,
              `Trade value: ${money(ticket.tradeValue)}`,
              `Fee: ${ticket.feePercent}% = ${money(ticket.feeAmount)} in items`,
              `Fee received: ${ticket.feePaid ? "✅" : "⏳"}`,
              `Claimed MM: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Not claimed"}`,
              `Status: ${ticket.status}`
            ].join("\\n")
          )],
          ephemeral: true
        });
      }

      if (commandName === "history") {
        const history = db.orderHistory[interaction.user.id] || [];
        const text = history.length
          ? history.slice(-10).reverse().map(order => `• **#${order.orderId}** — ${money(order.finalTotal)} — ${order.completedAt ? `<t:${Math.floor(order.completedAt / 1000)}:R>` : "Completed"}`).join("\\n")
          : "You have no completed orders yet.";
        return interaction.reply({ embeds: [premiumEmbed("📦 Your Order History", text)], ephemeral: true });
      }

      if (commandName === "reportscammer") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");
        const proof = interaction.options.getString("proof");

        const report = {
          reporterId: interaction.user.id,
          reportedId: user.id,
          reason,
          proof,
          createdAt: Date.now()
        };

        editDatabase(database => database.scamReports.push(report));

        const embed = premiumEmbed(
          "🚨 New Scammer Report",
          `A report was submitted for staff review.`,
          0xe74c3c
        ).addFields(
          { name: "Reported User", value: `${user}\\n${user.tag}`, inline: true },
          { name: "Reporter", value: `${interaction.user}`, inline: true },
          { name: "Reason", value: reason, inline: false },
          { name: "Proof", value: proof, inline: false }
        );

        if (SCAM_REPORT_CHANNEL_ID) {
          const channel = await client.channels.fetch(SCAM_REPORT_CHANNEL_ID).catch(() => null);
          if (channel) await channel.send({ content: `<@&${REVIEW_ROLE_ID}>`, embeds: [embed] });
        } else {
          await interaction.channel.send({ embeds: [embed] });
        }

        return interaction.reply(ephemeral("✅ Report sent to staff. Do not harass the reported user while staff reviews it."));
      }

      if (commandName === "scammercheck") {
        const user = interaction.options.getUser("user");
        const warnings = userWarnings(user.id);
        const blacklist = db.blacklist[user.id];
        return interaction.reply({
          embeds: [premiumEmbed(
            "🔎 Security Check",
            [
              `User: ${user}`,
              `Blacklisted: ${blacklist ? "🚫 Yes" : "✅ No"}`,
              blacklist ? `Blacklist reason: ${blacklist.reason}` : "",
              `Warnings: ${warnings.length}`,
              "A new account or report is not proof of scamming. Staff should always review evidence."
            ].filter(Boolean).join("\\n"),
            blacklist ? 0xe74c3c : 0x2ecc71
          )],
          ephemeral: true
        });
      }

      if (commandName === "blacklist") {
        if (!isOwner(interaction.user.id)) return interaction.reply(ephemeral("👑 Owner only."));
        const sub = interaction.options.getSubcommand();

        if (sub === "list") {
          const entries = Object.entries(db.blacklist);
          const list = entries.length
            ? entries.map(([id, data]) => `• <@${id}> — ${data.reason}`).join("\\n")
            : "No users are blacklisted.";
          return interaction.reply({ embeds: [premiumEmbed("🚫 Blacklist", list, 0xe74c3c)], ephemeral: true });
        }

        const user = interaction.options.getUser("user");

        if (sub === "remove") {
          unblacklistUser(user.id);
          return interaction.reply(ephemeral(`✅ Removed ${user} from the blacklist.`));
        }

        const reason = interaction.options.getString("reason");
        blacklistUser(user.id, interaction.user.id, reason);
        await sendSecurityLog(premiumEmbed("🚫 User Blacklisted", `${user}\\nReason: ${reason}`, 0xe74c3c));
        return interaction.reply(ephemeral(`✅ Blacklisted ${user}.`));
      }

      if (commandName === "warn") {
        if (!canModerate(interaction)) return interaction.reply(ephemeral("❌ Moderators only."));
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");

        if (sub === "list") {
          const warnings = userWarnings(user.id);
          const list = warnings.length
            ? warnings.map((warning, index) => `**${index + 1}.** ${warning.reason} — <@${warning.moderatorId}>`).join("\\n")
            : "No warnings.";
          return interaction.reply({ embeds: [premiumEmbed(`⚠️ Warnings for ${user.username}`, list, 0xf1c40f)], ephemeral: true });
        }

        if (sub === "clear") {
          clearWarnings(user.id);
          return interaction.reply(ephemeral(`✅ Cleared warnings for ${user}.`));
        }

        const reason = interaction.options.getString("reason");
        addWarning(user.id, interaction.user.id, reason);
        return interaction.reply(`⚠️ ${user} was warned. Reason: **${reason}**`);
      }

      if (commandName === "timeout") {
        if (!canModerate(interaction)) return interaction.reply(ephemeral("❌ Moderators only."));
        const user = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const minutes = interaction.options.getInteger("minutes");
        const reason = interaction.options.getString("reason");
        if (!member) return interaction.reply(ephemeral("❌ Member not found."));
        await member.timeout(minutes * 60_000, reason);
        await sendSecurityLog(premiumEmbed("⏳ User Timed Out", `${user}\\n${minutes} minutes\\nReason: ${reason}`, 0xf1c40f));
        return interaction.reply(`⏳ ${user} was timed out for **${minutes} minutes**.`);
      }

      if (commandName === "kick") {
        if (!canKick(interaction)) return interaction.reply(ephemeral("❌ Kick permission required."));
        const user = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const reason = interaction.options.getString("reason");
        if (!member?.kickable) return interaction.reply(ephemeral("❌ I cannot kick this user."));
        await member.kick(reason);
        await sendSecurityLog(premiumEmbed("👢 User Kicked", `${user}\\nReason: ${reason}`, 0xe67e22));
        return interaction.reply(`👢 ${user.tag} was kicked.`);
      }

      if (commandName === "ban") {
        if (!canBan(interaction)) return interaction.reply(ephemeral("❌ Ban permission required."));
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");
        await interaction.guild.members.ban(user.id, { reason });
        await sendSecurityLog(premiumEmbed("🔨 User Banned", `${user}\\nReason: ${reason}`, 0xe74c3c));
        return interaction.reply(`🔨 ${user.tag} was banned.`);
      }

      if (commandName === "lockdown") {
        if (!isOwner(interaction.user.id)) return interaction.reply(ephemeral("👑 Owner only."));
        const mode = interaction.options.getString("mode");
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: mode === "unlock" ? null : false
        });
        return interaction.reply(mode === "lock" ? "🔒 Channel locked." : "🔓 Channel unlocked.");
      }

      if (commandName === "applications") {
        if (!isOwner(interaction.user.id)) return interaction.reply(ephemeral("👑 Owner only."));
        const mode = interaction.options.getString("mode");
        if (mode === "status") {
          return interaction.reply(ephemeral(`Applications are currently **${applicationIsOpen() ? "OPEN" : "CLOSED"}**.`));
        }
        editDatabase(database => {
          database.applicationSettings.open = mode === "open";
        });
        return interaction.reply(`📝 Applications are now **${mode.toUpperCase()}**.`);
      }

      if (commandName === "panel") {
        if (isBuyerTicket(interaction.channel)) {
          return interaction.reply(shopPanel());
        }

        if (isMMTicket(interaction.channel)) {
          return interaction.reply(mmPanel());
        }

        if (isApplicationTicket(interaction.channel)) {
          return interaction.reply(applicationPanel());
        }

        return interaction.reply(
          ephemeral("❌ Use this inside a buyer, MM, or application ticket.")
        );
      }

      if (commandName === "addtoticket") {
        if (
          !isOwner(interaction.user.id) &&
          !isSeller(interaction) &&
          !isAnyMM(interaction)
        ) {
          return interaction.reply(
            ephemeral("❌ Staff/MM only.")
          );
        }

        const user = interaction.options.getUser("user");

        await addUserToTicket(interaction.channel, user.id);

        return interaction.reply(`✅ Added ${user} to this ticket.`);
      }

      if (commandName === "close") {
        const hasVouch = db.vouchedTickets.includes(
          interaction.channel.id
        );

        if (!hasVouch && !isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("⭐ A required vouch must be submitted first.")
          );
        }

        await interaction.reply("🔒 Closing ticket in 5 seconds...");

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 5000);

        return;
      }

      if (commandName === "credit") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("👑 Only the owner can use this.")
          );
        }

        const subcommand = interaction.options.getSubcommand();
        const user =
          interaction.options.getUser("user") || interaction.user;

        if (subcommand === "check") {
          return interaction.reply(
            ephemeral(
              `${user} has **${money(getCredit(user.id))}** store credit.`
            )
          );
        }

        const amount = interaction.options.getNumber("amount");
        let balance;

        if (subcommand === "add") {
          balance = addCredit(user.id, amount);
        } else if (subcommand === "remove") {
          balance = removeCredit(user.id, amount);
        } else {
          balance = setCredit(user.id, amount);
        }

        return interaction.reply(
          ephemeral(
            `✅ Credit updated for ${user}.\nNew balance: **${money(balance)}**`
          )
        );
      }

      if (commandName === "discount") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("👑 Only the owner can use this.")
          );
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
          return interaction.showModal(discountCreateModal());
        }

        if (subcommand === "disable") {
          const code = interaction.options
            .getString("code")
            .toUpperCase();

          editDatabase(database => {
            if (database.discounts[code]) {
              database.discounts[code].active = false;
            }
          });

          return interaction.reply(
            ephemeral(`✅ Discount **${code}** disabled.`)
          );
        }

        const discounts = Object.values(db.discounts);

        const text =
          discounts.length > 0
            ? discounts
                .map(discount => {
                  const valueText =
                    discount.type === "percent"
                      ? `${discount.amount}%`
                      : money(discount.amount);

                  return [
                    `**${discount.code}**`,
                    `Value: ${valueText}`,
                    `Uses: ${discount.used}/${discount.maxUses}`,
                    `Per user: ${discount.perUserLimit}`,
                    `Status: ${discount.active ? "Active" : "Disabled"}`
                  ].join(" • ");
                })
                .join("\n")
            : "No discount codes exist.";

        return interaction.reply({
          embeds: [
            premiumEmbed(
              "🎟️ Discount Codes",
              text,
              0xf1c40f
            )
          ],
          ephemeral: true
        });
      }

      if (commandName === "owner") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("👑 Only the owner can use this.")
          );
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "unclaim") {
          removeClaim(interaction.channel.id);

          return interaction.reply(
            "👑 Owner removed the current claim."
          );
        }

        if (subcommand === "transferclaim") {
          const user = interaction.options.getUser("user");
          const existingClaim = getClaim(interaction.channel.id);

          setClaim(
            interaction.channel.id,
            user.id,
            existingClaim?.type || "owner_transfer"
          );

          if (db.mmTickets[interaction.channel.id]) {
            editDatabase(database => {
              database.mmTickets[interaction.channel.id].claimedBy =
                user.id;
            });
          }

          return interaction.reply(
            `👑 Owner transferred the claim to ${user}.`
          );
        }

        if (subcommand === "forcecomplete") {
          editDatabase(database => {
            if (database.orders[interaction.channel.id]) {
              database.orders[interaction.channel.id].status =
                "completed_by_owner";
            }

            if (database.mmTickets[interaction.channel.id]) {
              database.mmTickets[interaction.channel.id].status =
                "completed_by_owner";
            }
          });

          return interaction.reply(
            "👑 Owner force-completed this ticket."
          );
        }

        await interaction.reply(
          "👑 Owner force-closing this ticket..."
        );

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 1500);

        return;
      }
    }

    // ----------------------
    // BUTTONS
    // ----------------------
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === "shop_add_seed") {
        return interaction.reply(shopItemMenu("seeds", 0));
      }

      if (customId === "shop_add_pet") {
        return interaction.reply(shopItemMenu("pets", 0));
      }

      if (customId.startsWith("shop_page_")) {
        const parts = customId.split("_");
        const category = parts[2];
        const page = Number(parts[3]);

        return interaction.update(shopItemMenu(category, page));
      }

      if (customId === "shop_view_cart") {
        return interaction.reply({
          embeds: [buildCartEmbed(interaction.user.id)],
          components: [cartButtons()],
          ephemeral: true
        });
      }

      if (customId === "shop_clear_cart") {
        clearCart(interaction.user.id);

        return interaction.reply(
          ephemeral("🗑️ Your cart was cleared.")
        );
      }

      if (customId === "shop_remove_item") {
        const cart = getCart(interaction.user.id);

        if (cart.length === 0) {
          return interaction.reply(
            ephemeral("❌ Your cart is empty.")
          );
        }

        return interaction.reply({
          content: "Choose an item to remove:",
          components: [removeItemMenu(interaction.user.id)],
          ephemeral: true
        });
      }

      if (customId === "shop_checkout") {
        if (getCart(interaction.user.id).length === 0) {
          return interaction.reply(
            ephemeral("❌ Your cart is empty.")
          );
        }

        return interaction.showModal(checkoutModal());
      }

      if (customId === "order_claim") {
        if (!isSeller(interaction)) {
          return interaction.reply(
            ephemeral("❌ Sellers only.")
          );
        }

        const existingClaim = getClaim(interaction.channel.id);

        if (existingClaim && !isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral(
              `⚠️ This order is already claimed by <@${existingClaim.userId}>.`
            )
          );
        }

        setClaim(
          interaction.channel.id,
          interaction.user.id,
          "shop"
        );

        return interaction.reply(
          `🙋 Order claimed by ${interaction.user}`
        );
      }

      if (
        ["order_paid", "order_done", "order_cancel"].includes(
          customId
        )
      ) {
        if (!isSeller(interaction)) {
          return interaction.reply(
            ephemeral("❌ Sellers only.")
          );
        }

        const claim = getClaim(interaction.channel.id);

        if (!claimedByOrOwner(interaction, claim)) {
          return interaction.reply(
            ephemeral(
              `❌ Only the claimed seller or owner can do this.`
            )
          );
        }

        if (customId === "order_paid") {
          editDatabase(database => {
            if (database.orders[interaction.channel.id]) {
              database.orders[interaction.channel.id].status =
                "payment_received";
            }
          });

          return interaction.reply(
            "💳 Payment marked as received."
          );
        }

        if (customId === "order_cancel") {
          editDatabase(database => {
            if (database.orders[interaction.channel.id]) {
              database.orders[interaction.channel.id].status =
                "cancelled";
            }
          });

          return interaction.reply("❌ Order cancelled.");
        }

        editDatabase(database => {
          const order = database.orders[interaction.channel.id];
          if (order) {
            order.status = "delivered_waiting_vouch";
            if (!database.orderHistory[order.buyerId]) database.orderHistory[order.buyerId] = [];
            if (!database.orderHistory[order.buyerId].some(item => item.orderId === order.orderId)) {
              database.orderHistory[order.buyerId].push({
                ...order,
                completedAt: Date.now()
              });
            }
          }
        });

        return interaction.reply({
          content:
            "📦 Order delivered. The buyer must now submit the required shop vouch.",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("vouch_shop")
                .setLabel("Write Shop Vouch")
                .setEmoji("⭐")
                .setStyle(ButtonStyle.Success)
            )
          ]
        });
      }

      if (customId === "mm_start") {
        if (!isMMTicket(interaction.channel)) {
          return interaction.reply(
            ephemeral("❌ MM tickets only.")
          );
        }

        return interaction.reply({
          content: "Choose trade size:",
          components: [mmSizeMenu()],
          ephemeral: true
        });
      }


      if (customId === "mm_confirm_trader1" || customId === "mm_confirm_trader2") {
        const ticket = db.mmTickets[interaction.channel.id];
        if (!ticket) return interaction.reply(ephemeral("❌ No MM request exists here."));

        const isTrader1Button = customId === "mm_confirm_trader1";
        const requiredUserId = isTrader1Button ? ticket.trader1Id : ticket.trader2Id;

        if (!isOwner(interaction.user.id) && interaction.user.id !== requiredUserId) {
          return interaction.reply(ephemeral(`❌ Only Trader ${isTrader1Button ? "1" : "2"} can press this button.`));
        }

        editDatabase(database => {
          const current = database.mmTickets[interaction.channel.id];
          if (isTrader1Button) current.trader1Confirmed = true;
          else current.trader2Confirmed = true;
          if (current.trader1Confirmed && current.trader2Confirmed) current.status = "both_traders_confirmed";
        });

        const updated = db.mmTickets[interaction.channel.id];
        return interaction.reply(
          `✅ Trader ${isTrader1Button ? "1" : "2"} confirmed.\\n` +
          `Trader 1: ${updated.trader1Confirmed ? "✅" : "⏳"} | Trader 2: ${updated.trader2Confirmed ? "✅" : "⏳"}`
        );
      }

      if (customId === "mm_claim") {
        if (!isAnyMM(interaction)) {
          return interaction.reply(
            ephemeral("❌ MM only.")
          );
        }

        const ticket = db.mmTickets[interaction.channel.id];

        if (!ticket) {
          return interaction.reply(
            ephemeral("❌ No MM request exists in this ticket.")
          );
        }

        const requiredRole = mmRoleForSize(ticket.size);

        if (
          !isOwner(interaction.user.id) &&
          !hasRole(interaction, requiredRole.roleId)
        ) {
          return interaction.reply(
            ephemeral(
              `❌ This trade requires the **${requiredRole.roleName}** role.`
            )
          );
        }

        if (ticket.claimedBy && !isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral(
              `⚠️ This ticket is already claimed by <@${ticket.claimedBy}>. Nobody can cut over them.`
            )
          );
        }

        editDatabase(database => {
          database.mmTickets[interaction.channel.id].claimedBy =
            interaction.user.id;

          database.mmTickets[interaction.channel.id].claimedAt =
            Date.now();

          database.claims[interaction.channel.id] = {
            userId: interaction.user.id,
            type: "mm",
            claimedAt: Date.now()
          };
        });

        const claimedTicket = db.mmTickets[interaction.channel.id];

        await interaction.channel.send({
          content: `<@${claimedTicket.trader1Id}> <@${claimedTicket.trader2Id}>`,
          embeds: [
            premiumEmbed(
              "✅ FINAL TRADE CHECK",
              [
                "# Both traders must confirm",
                "",
                "Read the trade carefully.",
                "Only press your own confirmation button.",
                "",
                `**Claimed MM:** <@${interaction.user.id}>`
              ].join("\n"),
              0xf1c40f
            ).addFields(
              {
                name: "📦 Trader 1 Gives",
                value: formatParsedItems(claimedTicket.trader1Items),
                inline: false
              },
              {
                name: "📦 Trader 2 Gives",
                value: formatParsedItems(claimedTicket.trader2Items),
                inline: false
              },
              {
                name: "🎁 MM Fee",
                value: `${claimedTicket.feePercent}% = **${money(claimedTicket.feeAmount)} worth of in-game items**`,
                inline: false
              },
              {
                name: "Confirmations",
                value: "Trader 1: ⏳\nTrader 2: ⏳",
                inline: false
              }
            )
          ],
          components: [mmConfirmationButtons()]
        });

        return interaction.reply(
          `🛡️ MM ticket claimed by ${interaction.user}. Both traders must now confirm.`
        );
      }

      if (
        ["mm_fee", "mm_fee_paid", "mm_done", "mm_cancel"].includes(
          customId
        )
      ) {
        if (!isAnyMM(interaction)) {
          return interaction.reply(
            ephemeral("❌ MM only.")
          );
        }

        const ticket = db.mmTickets[interaction.channel.id];

        if (!ticket?.claimedBy) {
          return interaction.reply(
            ephemeral("❌ This MM ticket has not been claimed.")
          );
        }

        if (
          !isOwner(interaction.user.id) &&
          ticket.claimedBy !== interaction.user.id
        ) {
          return interaction.reply(
            ephemeral(
              `❌ Only the claimed MM can use this. Claimed MM: <@${ticket.claimedBy}>`
            )
          );
        }

        if (customId === "mm_fee") {
          return interaction.showModal(mmFeeModal());
        }

        if (customId === "mm_fee_paid") {
          editDatabase(database => {
            database.mmTickets[interaction.channel.id].feePaid = true;
            database.mmTickets[interaction.channel.id].status = "fee_received";
          });

          return interaction.reply("✅ The claimed MM confirmed that the required in-game item fee was received.");
        }

        if (customId === "mm_cancel") {
          editDatabase(database => {
            database.mmTickets[interaction.channel.id].status =
              "cancelled";
          });

          return interaction.reply("❌ MM request cancelled.");
        }

        if (!ticket.feePaid && !isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("❌ The MM fee must be received before the trade can be completed.")
          );
        }

        editDatabase(database => {
          database.mmTickets[interaction.channel.id].status =
            "completed_waiting_vouch";
        });

        return interaction.reply({
          content:
            "📦 Trade completed. Both traders should submit an MM vouch.",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("vouch_mm")
                .setLabel("Write MM Vouch")
                .setEmoji("⭐")
                .setStyle(ButtonStyle.Success)
            )
          ]
        });
      }

      if (customId === "vouch_shop") {
        return interaction.showModal(vouchModal("shop"));
      }

      if (customId === "vouch_mm") {
        return interaction.showModal(vouchModal("mm"));
      }

      if (customId === "apply_start") {
        if (!applicationIsOpen() && !isOwner(interaction.user.id)) {
          return interaction.reply(ephemeral("📝 Applications are currently closed."));
        }
        return interaction.reply({
          content: "Choose a position:",
          components: [applicationChoiceButtons()],
          ephemeral: true
        });
      }

      if (customId === "apply_mm") {
        const existing = db.applications[interaction.user.id];
        if (existing?.submittedAt && Date.now() - existing.submittedAt < 7 * 24 * 60 * 60 * 1000) {
          return interaction.reply(ephemeral("⏳ You can only submit one application every 7 days."));
        }
        return interaction.showModal(mmApplicationPart1Modal());
      }

      if (customId === "apply_admin") {
        const existing = db.applications[interaction.user.id];
        if (existing?.submittedAt && Date.now() - existing.submittedAt < 7 * 24 * 60 * 60 * 1000) {
          return interaction.reply(ephemeral("⏳ You can only submit one application every 7 days."));
        }
        return interaction.showModal(
          adminApplicationPart1Modal()
        );
      }

      if (customId === "mm_apply_continue") {
        return interaction.showModal(mmApplicationPart2Modal());
      }

      if (customId === "admin_apply_continue") {
        return interaction.showModal(
          adminApplicationPart2Modal()
        );
      }

      if (customId.startsWith("application_accept_")) {
        if (!isReviewer(interaction)) {
          return interaction.reply(
            ephemeral("❌ Review role or owner only.")
          );
        }

        return interaction.reply(
          `✅ Application accepted by ${interaction.user}.`
        );
      }

      if (customId.startsWith("application_deny_")) {
        if (!isReviewer(interaction)) {
          return interaction.reply(
            ephemeral("❌ Review role or owner only.")
          );
        }

        return interaction.reply(
          `❌ Application denied by ${interaction.user}.`
        );
      }
    }

    // ----------------------
    // STRING SELECT MENUS
    // ----------------------
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId.startsWith("shop_pick_")) {
        const parts = customId.split("_");
        const category = parts[2];
        const itemName = interaction.values[0];

        return interaction.showModal(
          quantityModal(category, itemName)
        );
      }

      if (customId === "shop_remove_select") {
        const index = Number(interaction.values[0]);

        removeCartItem(interaction.user.id, index);

        return interaction.update({
          content: "✅ Item removed.",
          components: [],
          embeds: [buildCartEmbed(interaction.user.id)]
        });
      }

      if (customId === "mm_size") {
        const size = interaction.values[0];

        return interaction.reply({
          content: "Select the other trader:",
          components: [mmTraderMenu(size)],
          ephemeral: true
        });
      }
    }

    // ----------------------
    // USER SELECT MENUS
    // ----------------------
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId.startsWith("mm_trader_")) {
        const size = interaction.customId.replace(
          "mm_trader_",
          ""
        );

        const traderId = interaction.values[0];

        if (traderId === interaction.user.id) {
          return interaction.reply(
            ephemeral("❌ You cannot select yourself.")
          );
        }

        await addUserToTicket(interaction.channel, traderId);

        return interaction.showModal(
          mmDetailsModal(size, traderId)
        );
      }
    }

    // ----------------------
    // MODALS
    // ----------------------
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      if (customId.startsWith("shop_quantity_")) {
        const parts = customId.split("_");
        const category = parts[2];
        const encodedName = parts.slice(3).join("_");

        const itemName = Buffer.from(
          encodedName,
          "base64"
        ).toString("utf8");

        const quantity = safeWholeNumber(
          interaction.fields.getTextInputValue("quantity")
        );

        if (!quantity) {
          return interaction.reply(
            ephemeral(
              "❌ Quantity must be a whole number from 1 to 100000."
            )
          );
        }

        addToCart(
          interaction.user.id,
          category,
          itemName,
          quantity
        );

        return interaction.reply({
          content: `✅ Added **${itemName} ×${quantity}** to your cart.`,
          embeds: [buildCartEmbed(interaction.user.id)],
          components: [cartButtons()],
          ephemeral: true
        });
      }

      if (customId === "shop_checkout_modal") {
        return createOrderFromCart(interaction);
      }

      if (customId.startsWith("mm_details_")) {
        const parts = customId.split("_");
        const chosenSize = parts[2];
        const traderId = parts[3];

        const trader1Raw =
          interaction.fields.getTextInputValue("gives1");

        const trader2Raw =
          interaction.fields.getTextInputValue("gives2");

        const trader1Parsed = parseStoreItems(trader1Raw);
        const trader2Parsed = parseStoreItems(trader2Raw);

        const unknown = [
          ...trader1Parsed.unknown,
          ...trader2Parsed.unknown
        ];

        if (
          !trader1Parsed.items.length ||
          !trader2Parsed.items.length ||
          unknown.length
        ) {
          return interaction.reply(
            ephemeral(
              [
                "❌ I could not understand every item.",
                "",
                "Use this format:",
                "`20 Mega Seed, 3 Unicorn`",
                unknown.length
                  ? `Unknown items: ${unknown.join(", ")}`
                  : ""
              ].filter(Boolean).join("\\n")
            )
          );
        }

        const tradeValue = Math.max(
          trader1Parsed.total,
          trader2Parsed.total
        );

        const tier = mmTierFromValue(tradeValue);
        const feePercent = tier.feePercent;
        const feeAmount = tradeValue * (feePercent / 100);
        const feeDeadline = Date.now() + 10 * 60 * 1000;

        editDatabase(database => {
          database.mmTickets[interaction.channel.id] = {
            size: tier.size,
            trader1Id: interaction.user.id,
            trader2Id: traderId,
            trader1Items: trader1Parsed.items,
            trader2Items: trader2Parsed.items,
            trader1Value: trader1Parsed.total,
            trader2Value: trader2Parsed.total,
            tradeValue,
            feePercent,
            feeAmount,
            feeDeadline,
            trader1Confirmed: false,
            trader2Confirmed: false,
            requiredRoleId: tier.roleId,
            requiredRoleName: tier.roleName,
            claimedBy: null,
            claimedAt: null,
            feeItems: null,
            feePayer: null,
            feePaid: false,
            status: "waiting_for_mm",
            createdAt: Date.now()
          };
        });

        const ticket = db.mmTickets[interaction.channel.id];

        const embed = premiumEmbed(
          "🛡️ MM NEEDED",
          [
            "# The bot calculated the trade",
            "",
            `**Trade size:** ${ticket.size.toUpperCase()}`,
            `**Required MM:** ${ticket.requiredRoleName}`,
            "",
            "An MM must claim first. After claiming, both traders will confirm the final details."
          ].join("\\n"),
          0x5865f2
        ).addFields(
          {
            name: "👤 Trader 1",
            value: `<@${ticket.trader1Id}>`,
            inline: true
          },
          {
            name: "👤 Trader 2",
            value: `<@${ticket.trader2Id}>`,
            inline: true
          },
          {
            name: "📦 Trader 1 Gives",
            value: formatParsedItems(ticket.trader1Items),
            inline: false
          },
          {
            name: "📦 Trader 2 Gives",
            value: formatParsedItems(ticket.trader2Items),
            inline: false
          },
          {
            name: "💰 Trader 1 Value",
            value: money(ticket.trader1Value),
            inline: true
          },
          {
            name: "💰 Trader 2 Value",
            value: money(ticket.trader2Value),
            inline: true
          },
          {
            name: "🎁 MM Fee",
            value: `${ticket.feePercent}% = **${money(ticket.feeAmount)} worth of in-game items**`,
            inline: false
          }
        );

        await interaction.channel.send({
          content: `<@&${ticket.requiredRoleId}> New MM trade ready to claim!`,
          embeds: [embed],
          components: mmActionButtons()
        });

        return interaction.reply(
          ephemeral("✅ Trade created. The bot calculated the value using the shop prices.")
        );
      }

      if (customId === "mm_fee_modal") {
        const ticket = db.mmTickets[interaction.channel.id];

        if (!ticket?.claimedBy) {
          return interaction.reply(
            ephemeral("❌ This ticket has not been claimed.")
          );
        }

        if (
          !isOwner(interaction.user.id) &&
          ticket.claimedBy !== interaction.user.id
        ) {
          return interaction.reply(
            ephemeral("❌ Only the claimed MM can set the fee.")
          );
        }

        const feeItems =
          interaction.fields.getTextInputValue("items");

        const feePayer =
          interaction.fields.getTextInputValue("payer");

        editDatabase(database => {
          database.mmTickets[interaction.channel.id].feeItems =
            feeItems;

          database.mmTickets[interaction.channel.id].feePayer =
            feePayer;
        });

        return interaction.reply({
          embeds: [
            premiumEmbed(
              "🎁 MM Item Fee Required",
              [
                `**Required value:** ${money(ticket.feeAmount)} (${ticket.feePercent}%)`,
                `**Items:** ${feeItems}`,
                `**Paid by:** ${feePayer}`,
                "",
                "No real-money MM fee is allowed."
              ].join("\n"),
              0xf1c40f
            )
          ]
        });
      }

      if (customId === "vouch_modal_shop") {
        return submitVouch(interaction, "shop");
      }

      if (customId === "vouch_modal_mm") {
        return submitVouch(interaction, "mm");
      }

      if (customId === "owner_discount_create") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply(
            ephemeral("👑 Only the owner can do this.")
          );
        }

        const code =
          interaction.fields.getTextInputValue("code");

        const typeRaw =
          interaction.fields
            .getTextInputValue("type")
            .toLowerCase();

        const type =
          typeRaw.includes("percent") ||
          typeRaw.includes("%")
            ? "percent"
            : "dollar";

        const amount = Number(
          interaction.fields.getTextInputValue("amount")
        );

        const maxUses = safeWholeNumber(
          interaction.fields.getTextInputValue("uses")
        );

        const perUserLimit = safeWholeNumber(
          interaction.fields.getTextInputValue("peruser")
        );

        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          !maxUses ||
          !perUserLimit
        ) {
          return interaction.reply(
            ephemeral("❌ Invalid discount values.")
          );
        }

        const created = createDiscountCode({
          code,
          type,
          amount,
          maxUses,
          perUserLimit,
          createdBy: interaction.user.id
        });

        return interaction.reply(
          ephemeral(
            [
              `✅ Created **${created.code}**`,
              `Type: **${created.type}**`,
              `Value: **${
                created.type === "percent"
                  ? `${created.amount}%`
                  : money(created.amount)
              }**`,
              `Total uses: **${created.maxUses}**`,
              `Uses per user: **${created.perUserLimit}**`
            ].join("\n")
          )
        );
      }

      if (customId === "mm_apply_part1") {
        editDatabase(database => {
          database.applications[interaction.user.id] = {
            type: "mm",
            vouches:
              interaction.fields.getTextInputValue("vouches"),
            timezone:
              interaction.fields.getTextInputValue("timezone"),
            activity:
              interaction.fields.getTextInputValue("activity"),
            server_time:
              interaction.fields.getTextInputValue(
                "server_time"
              ),
            available:
              interaction.fields.getTextInputValue("available")
          };
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("mm_apply_continue")
            .setLabel("Continue Part 2")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({
          content: "✅ Part 1 saved.",
          components: [row],
          ephemeral: true
        });
      }

      if (customId === "mm_apply_part2") {
        const part1 = db.applications[interaction.user.id];

        if (!part1 || part1.type !== "mm") {
          return interaction.reply(
            ephemeral("❌ Start the application again.")
          );
        }

        const data = {
          ...part1,
          experience:
            interaction.fields.getTextInputValue("experience"),
          why:
            interaction.fields.getTextInputValue("why"),
          choose:
            interaction.fields.getTextInputValue("choose")
        };

        editDatabase(database => {
          database.applications[interaction.user.id] = {
            type: "mm",
            submittedAt: Date.now()
          };
        });

        return sendApplication(interaction, "mm", data);
      }

      if (customId === "admin_apply_part1") {
        editDatabase(database => {
          database.applications[interaction.user.id] = {
            type: "admin",
            age:
              interaction.fields.getTextInputValue("age"),
            timezone:
              interaction.fields.getTextInputValue("timezone"),
            activity:
              interaction.fields.getTextInputValue("activity"),
            server_time:
              interaction.fields.getTextInputValue(
                "server_time"
              ),
            experience:
              interaction.fields.getTextInputValue("experience")
          };
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("admin_apply_continue")
            .setLabel("Continue Part 2")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({
          content: "✅ Part 1 saved.",
          components: [row],
          ephemeral: true
        });
      }

      if (customId === "admin_apply_part2") {
        const part1 = db.applications[interaction.user.id];

        if (!part1 || part1.type !== "admin") {
          return interaction.reply(
            ephemeral("❌ Start the application again.")
          );
        }

        const data = {
          ...part1,
          rule:
            interaction.fields.getTextInputValue("rule"),
          abuse:
            interaction.fields.getTextInputValue("abuse"),
          why:
            interaction.fields.getTextInputValue("why"),
          choose:
            interaction.fields.getTextInputValue("choose")
        };

        editDatabase(database => {
          database.applications[interaction.user.id] = {
            type: "admin",
            submittedAt: Date.now()
          };
        });

        return sendApplication(interaction, "admin", data);
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        ephemeral("❌ Something went wrong. Please tell the owner.")
      );
    }
  }
});

// ======================================================
// AUTO PANELS
// ======================================================
client.on("channelCreate", channel => {
  setTimeout(async () => {
    try {
      if (!channel?.isTextBased()) return;

      if (isBuyerTicket(channel)) {
        await channel.send(shopPanel());
      }

      if (isMMTicket(channel)) {
        await channel.send(mmPanel());
      }

      if (isApplicationTicket(channel)) {
        await channel.send(applicationPanel());
      }
    } catch (error) {
      console.error("Auto panel error:", error);
    }
  }, 2500);
});


// ======================================================
// MM FEE DEADLINE WATCH
// ======================================================
setInterval(async () => {
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(db.mmTickets)) {
    if (
      !ticket.feePaid &&
      ticket.feeDeadline &&
      now >= ticket.feeDeadline &&
      !["cancelled", "completed_waiting_vouch", "completed_by_owner", "closed_for_unpaid_fee"].includes(ticket.status)
    ) {
      ticket.status = "closed_for_unpaid_fee";
      saveDatabase();

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (channel) {
        await channel.send(
          "⛔ The required MM fee was not confirmed within 10 minutes. This ticket will close in 10 seconds."
        ).catch(() => {});

        setTimeout(() => {
          channel.delete("MM fee was not paid in time").catch(() => {});
        }, 10_000);
      }
    }
  }
}, 60_000);

// ======================================================
// READY / START
// ======================================================
client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`👑 Owner override ID: ${OWNER_ID}`);
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error("Startup error:", error);
    process.exit(1);
  });
