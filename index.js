require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// CATEGORY IDS
const BUYER_CATEGORY_ID = "1524567770002489584";
const MM_CATEGORY_ID = "1524570656291688652";

// ROLE IDS
const NEW_MM_ROLE_ID = "1523782888296939660";
const MM_ROLE_ID = "1516085004801802260";
const TRUSTED_MM_ROLE_ID = "1523783007842992238";
const SELLER_ROLE_ID = "1516085109378252810";

// VOUCH CHANNEL IDS
const BUYER_VOUCH_CHANNEL_ID = "1516081257547825232";
const MM_VOUCH_CHANNEL_ID = "1523533160506327090";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
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
    "Carrots": 0.10,
    "Bamboo": 0.10,
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
    "Bee": 0.10,
    "Big Bunny": 0.50,
    "Rainbow Bunny": 0.50
  }
};

function isBuyerTicket(channel) {
  return channel?.parentId === BUYER_CATEGORY_ID;
}

function isMMTicket(channel) {
  return channel?.parentId === MM_CATEGORY_ID;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

async function addMentionedUsersToTicket(interaction, text) {
  const mentionedIds = [...text.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);

  for (const userId of mentionedIds) {
    try {
      await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    } catch (err) {
      console.log(`Could not add user ${userId}:`, err.message);
    }
  }
}

function buyerPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Buyer Assistant")
    .setDescription("Click **Start Order** to begin your order.")
    .setColor(0x2ecc71);

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
  const embed = new EmbedBuilder()
    .setTitle("🛡️ Middleman Assistant")
    .setDescription("Click **Start MM Request** to begin.")
    .setColor(0x5865f2);

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
    .setPlaceholder("Choose a category")
    .addOptions(
      { label: "Seeds", value: "seeds", emoji: "🌱" },
      { label: "Gear", value: "gear", emoji: "🛠️" },
      { label: "Pets", value: "pets", emoji: "🐾" },
      { label: "Other", value: "other", emoji: "❓" }
    );

  return interaction.reply({
    content: "What would you like to buy?",
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
    description: "Type your own item"
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`buyer_item_${category}`)
    .setPlaceholder("Choose an item")
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content: "Choose the item you want:",
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function otherItemModal(interaction, category) {
  const modal = new ModalBuilder()
    .setCustomId(`buyer_other_${category}`)
    .setTitle("Custom Item");

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
  const orderId = Math.floor(1000 + Math.random() * 9000);

  let priceText = "Waiting for Seller";

  if (data.price !== null) {
    const total = data.price * data.amount;
    priceText = `${money(data.price)} each\nTotal: ${money(total)}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🛒 Order #${orderId}`)
    .setColor(0x2ecc71)
    .addFields(
      { name: "👤 Buyer", value: `${interaction.user}`, inline: false },
      { name: "📦 Category", value: data.category, inline: true },
      { name: "🛍️ Item", value: data.item, inline: true },
      { name: "🔢 Amount", value: String(data.amount), inline: true },
      { name: "💰 Price", value: priceText, inline: false },
      { name: "💳 Payment", value: data.payment, inline: false },
      { name: "📝 Notes", value: data.notes || "None", inline: false },
      { name: "⏳ Status", value: "Waiting for Seller", inline: false }
    )
    .setFooter({ text: "Bloom Bot Buyer Assistant" });

  await interaction.channel.send({
    content: `<@&${SELLER_ROLE_ID}> New order waiting!`,
    embeds: [embed],
    components: [orderButtons()]
  });

  return interaction.reply({
    content: "✅ Your order has been sent to the sellers.",
    ephemeral: true
  });
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

async function mmModal(interaction, size) {
  const modal = new ModalBuilder()
    .setCustomId(`mm_modal_${size}`)
    .setTitle("Middleman Request");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("trader1")
        .setLabel("Trader 1 @mention")
        .setPlaceholder("@username")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("trader2")
        .setLabel("Trader 2 @mention")
        .setPlaceholder("@username")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives1")
        .setLabel("What does Trader 1 give?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("gives2")
        .setLabel("What does Trader 2 give?")
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

  const embed = new EmbedBuilder()
    .setTitle("🛡️ Middleman Request")
    .setColor(0x5865f2)
    .addFields(
      { name: "👤 Trader 1", value: data.trader1, inline: true },
      { name: "👤 Trader 2", value: data.trader2, inline: true },
      { name: "📦 Trader 1 Gives", value: data.gives1, inline: false },
      { name: "📦 Trader 2 Gives", value: data.gives2, inline: false },
      { name: "📊 Trade Size", value: sizeText, inline: true },
      { name: "⏳ Status", value: statusText, inline: true }
    )
    .setFooter({ text: "Bloom Bot MM Assistant" });

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

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the correct assistant panel in this ticket"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show Bloom Bot commands")
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered.");
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

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
    } catch (err) {
      console.log("Auto panel error:", err.message);
    }
  }, 2500);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping") {
        return interaction.reply({
          content: `🏓 Pong! ${client.ws.ping}ms`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "help") {
        const embed = new EmbedBuilder()
          .setTitle("🌱 Bloom Bot Help")
          .setColor(0x2ecc71)
          .setDescription("Commands and systems:")
          .addFields(
            { name: "/panel", value: "Sends Buyer/MM assistant in ticket.", inline: false },
            { name: "/ping", value: "Check bot ping.", inline: false },
            { name: "Buyer Tickets", value: "Start order, choose item, auto price, seller buttons.", inline: false },
            { name: "MM Tickets", value: "Start MM request, add traders, ping correct MM role.", inline: false }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.commandName === "panel") {
        if (isBuyerTicket(interaction.channel)) {
          return interaction.reply(buyerPanel());
        }

        if (isMMTicket(interaction.channel)) {
          return interaction.reply(mmPanel());
        }

        return interaction.reply({
          content: "❌ This only works inside Buyer or MM ticket categories.",
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "buyer_start") {
        if (!isBuyerTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ This only works in buyer tickets.",
            ephemeral: true
          });
        }

        return buyerCategoryMenu(interaction);
      }

      if (interaction.customId === "mm_start") {
        if (!isMMTicket(interaction.channel)) {
          return interaction.reply({
            content: "❌ This only works in MM tickets.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "Choose the trade size:",
          components: [mmSizeMenu()],
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith("order_")) {
        if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) {
          return interaction.reply({
            content: "❌ Sellers only.",
            ephemeral: true
          });
        }

        if (interaction.customId === "order_claim") {
          return interaction.reply(`🙋 Order claimed by ${interaction.user}`);
        }

        if (interaction.customId === "order_paid") {
          return interaction.reply("💳 Payment marked as received.");
        }

        if (interaction.customId === "order_done") {
          return interaction.reply(
            `📦 Order marked as delivered.\n\n⭐ Buyer, please vouch here: <#${BUYER_VOUCH_CHANNEL_ID}>`
          );
        }

        if (interaction.customId === "order_cancel") {
          return interaction.reply("❌ Order cancelled.");
        }
      }

      if (interaction.customId.startsWith("mm_")) {
        const hasMMRole =
          interaction.member.roles.cache.has(NEW_MM_ROLE_ID) ||
          interaction.member.roles.cache.has(MM_ROLE_ID) ||
          interaction.member.roles.cache.has(TRUSTED_MM_ROLE_ID);

        if (!hasMMRole) {
          return interaction.reply({
            content: "❌ Middlemen only.",
            ephemeral: true
          });
        }

        if (interaction.customId === "mm_claim") {
          return interaction.reply(`🛡️ MM claimed by ${interaction.user}`);
        }

        if (interaction.customId === "mm_confirmed") {
          return interaction.reply("✅ Both traders confirmed.");
        }

        if (interaction.customId === "mm_done") {
          return interaction.reply(
            `📦 Trade completed successfully.\n\n⭐ Both traders, please vouch here: <#${MM_VOUCH_CHANNEL_ID}>`
          );
        }

        if (interaction.customId === "mm_cancel") {
          return interaction.reply("❌ MM request cancelled.");
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "buyer_category") {
        const category = interaction.values[0];
        return itemMenu(interaction, category);
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
        return mmModal(interaction, size);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("buyer_other_")) {
        const category = interaction.customId.replace("buyer_other_", "");
        const item = interaction.fields.getTextInputValue("item");
        const amountRaw = interaction.fields.getTextInputValue("amount");
        const payment = interaction.fields.getTextInputValue("payment");
        const notes = interaction.fields.getTextInputValue("notes") || "None";

        const amount = Number(amountRaw);

        return sendOrderSummary(interaction, {
          category,
          item,
          amount: isNaN(amount) || amount <= 0 ? 1 : amount,
          payment,
          notes,
          price: null
        });
      }

      if (interaction.customId.startsWith("buyer_amount_")) {
        const parts = interaction.customId.split("_");
        const category = parts[2];
        const itemName = Buffer.from(parts.slice(3).join("_"), "base64").toString("utf8");

        const amountRaw = interaction.fields.getTextInputValue("amount");
        const payment = interaction.fields.getTextInputValue("payment");
        const notes = interaction.fields.getTextInputValue("notes") || "None";

        const amount = Number(amountRaw);

        return sendOrderSummary(interaction, {
          category,
          item: itemName,
          amount: isNaN(amount) || amount <= 0 ? 1 : amount,
          payment,
          notes,
          price: priceList[category][itemName]
        });
      }

      if (interaction.customId.startsWith("mm_modal_")) {
        const size = interaction.customId.replace("mm_modal_", "");

        const trader1 = interaction.fields.getTextInputValue("trader1");
        const trader2 = interaction.fields.getTextInputValue("trader2");

        await addMentionedUsersToTicket(interaction, trader1);
        await addMentionedUsersToTicket(interaction, trader2);

        return sendMMSummary(interaction, {
          size,
          trader1,
          trader2,
          gives1: interaction.fields.getTextInputValue("gives1"),
          gives2: interaction.fields.getTextInputValue("gives2")
        });
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

registerCommands();
client.login(TOKEN);