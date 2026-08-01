import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  Client, GatewayIntentBits, REST, Routes,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags,
  StringSelectMenuBuilder
} from 'discord.js';
import * as categories from './categories.js';
import * as youtube from './youtube.js';
import * as w2g from './w2g_push.js';
import * as history from './w2g_history.js';
import { buildWeightedQueue } from './queue_builder.js';
import { safeReply, safeDeferReply } from './interaction_utils.js';
import { ConfigValidationError, loadConfig } from './src/config/config.js';
import { createApplication } from './src/app/createApplication.js';
import { createCommandDefinitions } from './src/discord/commandDefinitions.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ==================== CONFIGURATION ====================
let config = null;
let rest = null;
let app = null;
let errorHandlersRegistered = false;
const commands = createCommandDefinitions();

function registerGlobalErrorHandlers() {
  if (errorHandlersRegistered) {
    return;
  }
  errorHandlersRegistered = true;
  process.on('unhandledRejection', (reason, p) => {
    console.error('❌ Unhandled Rejection:', p, 'reason:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
  });
}

async function startApplication() {
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('❌ Ungültige Konfiguration:', error.message);
      process.exit(1);
    }
    throw error;
  }

  registerGlobalErrorHandlers();

  youtube.configureYouTubeService({ apiKey: config.youtube.apiKey });
  w2g.configureW2GService({
    apiKey: config.w2g.apiKey,
    roomId: config.w2g.roomId,
    dryRun: config.w2g.dryRun,
    forceLive: config.w2g.forceLive,
    debug: config.w2g.debug,
    minRequestIntervalMs: config.w2g.minRequestIntervalMs
  });

  rest = new REST({ version: '10' }).setToken(config.discord.token);
  app = createApplication({
    config,
    client,
    rest,
    logger: console,
    commandDefinitions: commands
  });

  await registerCommands();
  await client.login(config.discord.token);
  return app;
}

// ==================== SESSION MANAGEMENT ====================
const sessions = new Map(); // userId -> sessionData

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {});
  }
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.delete(userId);
}

// ==================== COMMAND REGISTRATION ====================
const registerCommands = async () => {
  if (!rest || !config) {
    return;
  }

  try {
    console.log('📝 Registriere Slash Commands...');
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
      console.log('✅ Commands für Guild registriert');
    } else {
      await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      );
      console.log('✅ Commands global registriert');
    }
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
    process.exit(1);
  }
};

// ==================== EVENT HANDLERS ====================
client.once('clientReady', () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton() && 
      !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
    return;
  }

  try {
    // Handle Slash Commands
    if (interaction.isChatInputCommand() && interaction.commandName === 'krustentv') {
      const subcommand = interaction.options.getSubcommand();
      console.log(`📝 Slash Command: /krustentv ${subcommand} von ${interaction.user.username}`);
      await handleSlashCommand(interaction, subcommand);
      return;
    }

    // Handle Buttons
    if (interaction.isButton()) {
      const [action, ...params] = interaction.customId.split(':');
      console.log(`🔘 Button: ${action}:${params.slice(0, -1).join(':')} von ${interaction.user.username}`);
      await handleButtonPress(interaction, action, params);
      return;
    }

    // Handle Select Menus
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split(':');
      const userId = parts[parts.length - 1];
      const action = parts.slice(0, -1).join(':'); // Alles außer userId
      console.log(`📊 Select Menu: ${action} (${interaction.values.length} Wert(e)) von ${interaction.user.username}`);
      await handleSelectMenu(interaction, action, [userId]);
      return;
    }

    // Handle Modals
    if (interaction.isModalSubmit()) {
      // CustomID format: cat_add_modal_userId oder tv_watchtime_modal_userId
      const customId = interaction.customId;
      console.log(`  🔍 Debug CustomID: "${customId}"`);
      const lastUnderscoreIdx = customId.lastIndexOf('_');
      const userId = customId.substring(lastUnderscoreIdx + 1);
      const action = customId.substring(0, lastUnderscoreIdx);
      
      console.log(`📋 Modal Submit: ${action} | userId=${userId} von ${interaction.user.username}`);
      await handleModalSubmit(interaction, action, [userId]);
      return;
    }
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
    try {
      const msg = error.message || 'Ein Fehler ist aufgetreten';
      await safeReply(interaction, { content: `❌ ${msg}`, flags: MessageFlags.Ephemeral });
    } catch {
      console.error('❌ Konnte Fehlermeldung nicht senden');
    }
  }
});

// ==================== SLASH COMMAND HANDLER ====================
async function handleSlashCommand(interaction, subcommand) {
  console.log(`  📍 Verarbeite Subcommand: ${subcommand}`);
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

  switch (subcommand) {
    case 'menu':
      console.log(`  ✅ Zeige Hauptmenü`);
      await showMainMenu(interaction);
      break;
    case 'ping':
      console.log(`  ✅ Sende Pong`);
      await interaction.editReply({ content: 'Pong! 🏓' });
      break;
    case 'help':
      console.log(`  ✅ Zeige Hilfe`);
      await showHelp(interaction);
      break;
    default:
      console.warn(`  ⚠️ Unbekannter Subcommand: ${subcommand}`);
      await interaction.editReply({ content: '❌ Unbekannter Befehl' });
  }
}

// ==================== MAIN MENU ====================
async function showMainMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎬 KrüstchenTV Hauptmenü')
    .setDescription('Wähle einen Bereich:')
    .setColor(0x5865F2)
    .setThumbnail(client.user.avatarURL());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`nav:tv_start:${interaction.user.id}`)
      .setLabel('🎬 TV START')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`nav:admin:${interaction.user.id}`)
      .setLabel('🛠️ ADMIN')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`nav:help:${interaction.user.id}`)
      .setLabel('❓ HILFE')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== TV START FLOW ====================
/**
 * TV START FLOW - 5 Schritte
 * 1. Übersicht verfügbarer Videos
 * 2. Watchtime auswählen
 * 3. Kategorien auswählen
 * 4. Queue erstellen
 * 5. Ergebnis & Optionen
 */

async function startTVFlow(interaction) {
  console.log(`\n📺 === TV START FLOW STARTED ===`);
  clearSession(interaction.user.id);
  const session = getSession(interaction.user.id);
  session.step = 'overview';

  try {
    // STEP 1: Übersicht - Sammle Videos parallel
    console.log(`  📥 Schritt 1: Sammle Videos...`);
    const allCategories = await categories.getCategories();
    console.log(`  ✅ ${Object.keys(allCategories).length} Kategorien geladen`);
    
    const categoryVideos = {};
    let totalVideos = 0;
    let totalMinutes = 0;

    // Paralleles Laden aller Kategorien (schneller)
    const categoryPromises = Object.entries(allCategories).map(async ([catName, catData]) => {
      const channels = catData.channels || {};
      console.log(`    🔄 Kategorie "${catName}": ${Object.keys(channels).length} Channels`);

      // Lade alle Channel-Videos dieser Kategorie parallel
      const channelEntries = Object.entries(channels);
      const channelResults = await Promise.all(
        channelEntries.map(async ([channelId]) => {
          try {
            const channelVideos = await youtube.getChannelVideos(channelId, 50);
            const unseenVideos = await history.filterUnseenVideos(channelVideos);
            console.log(`      ✓ ${channelId}: ${unseenVideos.length} Videos`);
            return unseenVideos;
          } catch (error) {
            console.warn(`      ⚠️ Fehler für Channel ${channelId}: ${error.message}`);
            return [];
          }
        })
      );

      const videos = channelResults.flat();
      if (videos.length > 0) {
        // Lade Duration für alle Videos dieser Kategorie
        console.log(`    ⏳ Lade Dauer für ${videos.length} Videos...`);
        const videosWithDuration = [];
        for (const video of videos) {
          const details = await youtube.getVideoDetails(video.id);
          videosWithDuration.push({
            ...video,
            duration: details?.duration || 0
          });
        }
        
        // Berechne Gesamtdauer in Minuten
        const totalSeconds = videosWithDuration.reduce((sum, v) => sum + (v.duration || 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        
        console.log(`    ✅ "${catName}": ${videos.length} Videos, ${totalMinutes} Min`);
        return {
          catName,
          data: {
            videos: videosWithDuration,
            count: videos.length,
            minutes: totalMinutes
          }
        };
      }
      return null;
    });

    // Warte auf alle Kategorien mit Timeout
    const results = await Promise.all(categoryPromises);
    
    for (const result of results) {
      if (result) {
        categoryVideos[result.catName] = result.data;
        totalVideos += result.data.count;
        totalMinutes += result.data.minutes || 0;
      }
    }

    session.categoryVideos = categoryVideos;
    console.log(`  ✅ Schritt 1 fertig: ${totalVideos} Videos`);

    // Jetzt Antwort senden
    await interaction.editReply({ content: '✅ Videos geladen, wähle Watchtime...' });

    if (totalVideos === 0) {
      console.log(`  ⚠️ Keine neuen Videos vorhanden`);
      await interaction.editReply({ 
        content: '✅ Keine neuen Videos vorhanden. Alle Videos wurden bereits verarbeitet.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`nav:main:${interaction.user.id}`)
              .setLabel('⬅️ Hauptmenü')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      clearSession(interaction.user.id);
      return;
    }

    // Zeige Übersicht mit formatierter Liste
    let overviewText = '📊 **Verfügbare Videos**\n\n';
    
    for (const [catName, data] of Object.entries(categoryVideos)) {
      overviewText += `**${catName}** • ${data.count} Videos • ${data.minutes} Min\n`;
    }
    
    overviewText += `\n**Gesamt** • ${totalVideos} Videos • ${totalMinutes} Min`;

    const embed = new EmbedBuilder()
      .setDescription(overviewText)
      .setColor(0x5865F2);

    // STEP 2: Watchtime-Auswahl
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:30:${interaction.user.id}`)
        .setLabel('30 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:60:${interaction.user.id}`)
        .setLabel('60 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:90:${interaction.user.id}`)
        .setLabel('90 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime_custom:${interaction.user.id}`)
        .setLabel('Benutzerdefiniert')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nav:main:${interaction.user.id}`)
        .setLabel('⬅️ Hauptmenü')
        .setStyle(ButtonStyle.Secondary)
    );

    session.step = 'watchtime';
    await interaction.editReply({ 
      embeds: [embed],
      components: [row1, row2]
    });
  } catch (error) {
    console.error(`❌ Fehler im TV-Start: ${error.message}`);
    console.error(error.stack);
    await interaction.editReply({ content: `❌ ${error.message}` });
    clearSession(interaction.user.id);
  }
}

// ==================== ADMIN FLOW ====================
async function showAdminMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🛠️ ADMIN-BEREICH')
    .setDescription('Verwalte den Bot')
    .setColor(0xF0B132);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:overview:${interaction.user.id}`)
      .setLabel('📦 Übersicht')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin:categories:${interaction.user.id}`)
      .setLabel('📂 Kategorien')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:channels:${interaction.user.id}`)
      .setLabel('📺 Channels')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin:maintenance:${interaction.user.id}`)
      .setLabel('🧹 Wartung')
      .setStyle(ButtonStyle.Primary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`nav:main:${interaction.user.id}`)
      .setLabel('⬅️ Hauptmenü')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
}

// ==================== HELP ====================
async function showHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📖 KRÜSTCHENTV BOT - KOMPLETTE ANLEITUNG')
    .setDescription('Alle verfügbaren Slash Commands und Funktionen im Überblick')
    .setColor(0x2ECC71)
    .addFields({ name: 'Version', value: 'Alpha 0.1', inline: false })
    .addFields(
      {
        name: '⚡ Verfügbare Slash Commands',
        value: 
          '**`/krustentv menu`**\n' +
          '└ Öffnet das interaktive Hauptmenü mit TV START, Admin & Hilfe\n\n' +
          '**`/krustentv help`**\n' +
          '└ Zeigt diese Hilfeseite (alle Commands & Funktionen)\n\n' +
          '**`/krustentv ping`**\n' +
          '└ Verbindungstest - zeigt Bot-Latenz in Millisekunden',
        inline: false
      },
      {
        name: '🎬 TV START - Videos zu Watch2Gether pushen',
        value: 
          '**Schritt 1:** Videos sammeln\n' +
          '└ Lädt alle neuen Videos aus allen Kategorien\n\n' +
          '**Schritt 2:** Watchtime auswählen\n' +
          '└ 30 Min, 60 Min, 90 Min oder benutzerdefiniert\n\n' +
          '**Schritt 3:** Kategorien auswählen\n' +
          '└ Wähle, welche Kategorien in die Queue sollen\n\n' +
          '**Schritt 4:** Queue erstellen\n' +
          '└ Videos werden gewichtet & gemischt\n\n' +
          '**Schritt 5:** Zu W2G pushen\n' +
          '└ Videos werden zu Watch2Gether hochgeladen\n' +
          '└ Playlist-Link wird angezeigt\n' +
          '└ Videos werden als "gesehen" markiert',
        inline: false
      },
      {
        name: '🛠️ ADMIN - Kategorien & Channels verwalten',
        value: 
          '**📦 Übersicht**\n' +
          '└ Zeigt alle Kategorien mit Channels & Gewichtung\n\n' +
          '**📁 Kategorien**\n' +
          '├ Hinzufügen: Neue Kategorie erstellen\n' +
          '├ Umbenennen: Kategorie-Namen ändern\n' +
          '└ Löschen: Kategorie entfernen (inkl. aller Channels)\n\n' +
          '**📺 Channels**\n' +
          '├ Hinzufügen: YouTube-Channel zu Kategorie hinzufügen\n' +
          '├ Entfernen: Channel aus Kategorie löschen\n' +
          '└ Verschieben: Channel in andere Kategorie verschieben\n\n' +
          '**🧹 Wartung**\n' +
          '├ Health Check: Kategorien-Gesundheit prüfen\n' +
          '│  └ Zeigt letzte Uploads aller Channels\n' +
          '│  └ ✅ Aktiv (< 7 Tage) / ⚠️ Inaktiv (7-30 Tage) / ❌ Tot (> 30 Tage)\n' +
          '└ W2G Test: Watch2Gether API-Verbindung testen',
        inline: false
      },
      {
        name: '⚙️ System & Technisches',
        value: 
          '**Video-Filter:**\n' +
          '└ Nur Videos ≥ 60 Sekunden werden verwendet\n' +
          '└ Bereits gepushte Videos werden übersprungen\n\n' +
          '**Queue-Strategien:**\n' +
          '└ Shuffle: Zufällige Mischung nach Gewichtung\n' +
          '└ Category Blocks: Blockweise nach Kategorien\n' +
          '└ Manual Order: Manuelle Reihenfolge\n\n' +
          '**Caching:**\n' +
          '└ Videos werden als "gesehen" gespeichert\n' +
          '└ Cache ist 7 Tage gültig',
        inline: false
      },
      {
        name: '💡 Quick Start',
        value: 
          '1. `/krustentv menu` eingeben\n' +
          '2. "🎬 TV START" klicken\n' +
          '3. Watchtime wählen\n' +
          '4. Kategorien auswählen\n' +
          '5. "✅ Weiter" klicken\n' +
          '6. Fertig! Videos sind in W2G 🎉',
        inline: false
      }
    )
    .setFooter({ text: 'KrüstchenTV Bot • Automatische W2G Queue-Verwaltung' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`nav:main:${interaction.user.id}`)
      .setLabel('📋 Zum Hauptmenü')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== BUTTON HANDLER ====================
async function handleButtonPress(interaction, action, params) {
  // Check if this is a modal button (don't defer if modal)
  const isModalButton = (action === 'tv' && params[0] === 'watchtime_custom') ||
                        (action === 'cat' && params[0] === 'add') ||
                        (action === 'ch' && params[0] === 'add');
  
  if (!isModalButton) {
    // WICHTIG: deferUpdate() SOFORT ZUERST, bevor 3 Sekunden vergehen!
    try {
      await interaction.deferUpdate();
    } catch (err) {
      console.warn(`  ⚠️ Defer-Fehler: ${err.code}`);
      return;
    }
  }
  
  const userId = params[params.length - 1];
  console.log(`  🔐 User Check: Button-User=${userId}, Requester=${interaction.user.id}`);

  // Security check
  if (userId !== interaction.user.id) {
    console.warn(`  ❌ SECURITY: Unauthorized button press`);
    await interaction.followUp({ content: '❌ Nur du kannst diese Aktion ausführen', flags: MessageFlags.Ephemeral });
    return;
  }
  
  console.log(`  ✅ Button-Validierung ok, verarbeite: ${action}`);

  // Navigation
  if (action === 'nav') {
    const target = params[0];
    console.log(`  📍 Navigation zu: ${target}`);
    switch (target) {
      case 'main':
        await showMainMenu(interaction);
        break;
      case 'tv_start':
        await startTVFlow(interaction);
        break;
      case 'admin':
        await showAdminMenu(interaction);
        break;
      case 'help':
        await showHelp(interaction);
        break;
    }
    return;
  }

  // TV Flow
  if (action === 'tv') {
    console.log(`  🎬 TV Flow: ${params[0]}`);
    await handleTVButton(interaction, params, userId);
    return;
  }

  // Admin
  if (action === 'admin') {
    console.log(`  🛠️ Admin Action: ${params[0]}`);
    await handleAdminButton(interaction, params, userId);
    return;
  }

  // Category Admin
  if (action === 'cat') {
    const target = params[0];
    console.log(`  📂 Category Action: ${target}`);
    await handleCategoryAdminAction(interaction, `cat:${target}`, params, userId);
    return;
  }

  // Channel Admin
  if (action === 'ch') {
    const target = params[0];
    console.log(`  📺 Channel Action: ${target}`);
    await handleChannelAdminAction(interaction, `ch:${target}`, params, userId);
    return;
  }

  // Maintenance
  if (action === 'maint') {
    console.log(`  🧹 Maintenance: ${params[0]}`);
    await handleMaintenanceButton(interaction, params, userId);
    return;
  }

  console.warn(`  ⚠️ Unbekannte Button-Action: ${action}`);
}

async function handleTVButton(interaction, params, userId) {
  const session = getSession(userId);
  const target = params[0];
  console.log(`    🎬 TV Button: ${target}, Session Step: ${session.step}`);

  if (target === 'watchtime') {
    const minutes = parseInt(params[1]);
    console.log(`    ⏱️ Watchtime: ${minutes} Min`);
    session.watchtime = minutes;
    session.step = 'categories';
    await showCategorySelection(interaction, session, userId);
    return;
  }

  if (target === 'watchtime_custom') {
    console.log(`    📝 Custom Watchtime Modal öffnen`);
    const modal = new ModalBuilder()
      .setCustomId(`tv_watchtime_modal_${userId}`)
      .setTitle('Watchtime eingeben');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('minutes')
          .setLabel('Minuten')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  if (target === 'category') {
    const catName = decodeURIComponent(params[1]);
    const selected = session.selectedCategories || [];
    const isSelected = selected.includes(catName);
    console.log(`    📁 Category Toggle: "${catName}" → ${!isSelected ? 'selected' : 'deselected'}`);
    
    if (selected.includes(catName)) {
      session.selectedCategories = selected.filter(c => c !== catName);
    } else {
      session.selectedCategories = [...selected, catName];
    }

    await showCategorySelection(interaction, session, userId);
    return;
  }

  if (target === 'category_next') {
    console.log(`    ✅ Kategorien bestätigt: ${session.selectedCategories?.length || 0} ausgewählt`);
    if (!session.selectedCategories || session.selectedCategories.length === 0) {
      await interaction.editReply({ content: '❌ Bitte wähle mindestens eine Kategorie' });
      return;
    }

    session.step = 'strategy';
    await showStrategySelection(interaction, session, userId);
    return;
  }

  if (target === 'strategy') {
    const strategy = params[1]; // 'shuffle' oder 'category_blocks'
    console.log(`    🎲 Strategie gewählt: ${strategy}`);
    session.strategy = strategy;
    session.step = 'confirm';
    await showQueuePreview(interaction, session, userId);
    return;
  }

  if (target === 'strategy_back') {
    console.log(`    ◀️ Zurück zur Kategorieauswahl`);
    session.step = 'categories';
    await showCategorySelection(interaction, session, userId);
    return;
  }

  if (target === 'confirm_push') {
    console.log(`    🚀 Push bestätigt`);
    session.step = 'build';
    await buildAndPushQueue(interaction, session, userId);
    return;
  }

  if (target === 'confirm_back') {
    console.log(`    ◀️ Zurück zur Strategie-Auswahl`);
    session.step = 'strategy';
    await showStrategySelection(interaction, session, userId);
    return;
  }

  if (target === 'category_back') {
    console.log(`    ◀️ Zurück zu Watchtime`);
    session.step = 'watchtime';
    session.selectedCategories = [];
    
    // Re-show watchtime mit Übersicht
    const categoryVideos = session.categoryVideos || {};
    const embed = new EmbedBuilder()
      .setTitle('📊 Verfügbare Videos')
      .setColor(0x5865F2);

    const fields = [];
    let totalVideos = 0;
    let totalMinutes = 0;
    
    for (const [catName, data] of Object.entries(categoryVideos)) {
      fields.push({
        name: catName,
        value: `${data.count} Videos • ${data.minutes} Min`,
        inline: true
      });
      totalVideos += data.count;
      totalMinutes += data.minutes;
    }

    fields.push({
      name: 'Gesamt',
      value: `${totalVideos} Videos • ${totalMinutes} Min`,
      inline: false
    });

    embed.addFields(fields);
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:30:${userId}`)
        .setLabel('30 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:60:${userId}`)
        .setLabel('60 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime:90:${userId}`)
        .setLabel('90 Min')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:watchtime_custom:${userId}`)
        .setLabel('Benutzerdefiniert')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nav:main:${userId}`)
        .setLabel('⬅️ Hauptmenü')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
    return;
  }

  if (target === 'result_again') {
    console.log(`    🔁 Erneut starten`);
    await startTVFlow(interaction);
    return;
  }

  if (target === 'result_playlist') {
    console.log(`    📋 Playlist anschauen`);
    await handleW2GPlaylist(interaction, userId);
    return;
  }

  if (target === 'result_main') {
    console.log(`    ↩️ Zurück zum Hauptmenü`);
    clearSession(userId);
    await showMainMenu(interaction);
    return;
  }

  console.warn(`    ⚠️ Unbekannte TV-Action: ${target}`);
}

async function handleAdminButton(interaction, params, userId) {
  const target = params[0];

  switch (target) {
    case 'main':
    case 'back':
      await showAdminMenu(interaction);
      break;
    case 'overview':
      await showAdminOverview(interaction, userId);
      break;
    case 'categories':
      await showCategoryAdminMenu(interaction, userId);
      break;
    case 'channels':
      await showChannelAdminMenu(interaction, userId);
      break;
    case 'maintenance':
      await showMaintenanceMenu(interaction, userId);
      break;
  }
}

async function handleMaintenanceButton(interaction, params, userId) {
  const target = params[0];

  switch (target) {
    case 'health':
      await handleCategoryHealth(interaction, userId);
      break;
    case 'w2g_test':
      await handleW2GTest(interaction, userId);
      break;
  }
}

// ==================== ADMIN SUBMENUS ====================
async function showAdminOverview(interaction, userId) {
  const allCategories = await categories.getCategories();
  
  if (Object.keys(allCategories).length === 0) {
    await interaction.editReply({ 
      content: '📭 Keine Kategorien vorhanden',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`admin:categories:${userId}`)
            .setLabel('📂 Kategorien verwalten')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📦 Übersicht')
    .setColor(0x5865F2);

  const fields = [];
  for (const [catName, catData] of Object.entries(allCategories)) {
    const channels = catData.channels || {};
    const channelList = Object.keys(channels).length > 0
      ? Object.entries(channels).map(([id, data]) => `• ${data.name || id}`).join('\n')
      : '*Keine Channels*';
    
    fields.push({
      name: catName,
      value: channelList,
      inline: false
    });
  }

  embed.addFields(fields);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:back:${userId}`)
      .setLabel('⬅️ Admin-Menü')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function showCategoryAdminMenu(interaction, userId) {
  const embed = new EmbedBuilder()
    .setTitle('📂 KATEGORIEN')
    .setColor(0xF0B132);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cat:list:${userId}`)
      .setLabel('📋 Liste')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cat:add:${userId}`)
      .setLabel('➕ Hinzufügen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cat:rename:${userId}`)
      .setLabel('✏️ Umbenennen')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cat:delete:${userId}`)
      .setLabel('🗑️ Löschen')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`admin:main:${userId}`)
      .setLabel('⬅️ Admin-Menü')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

async function showChannelAdminMenu(interaction, userId) {
  const embed = new EmbedBuilder()
    .setTitle('📺 CHANNELS')
    .setColor(0xF0B132);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ch:list:${userId}`)
      .setLabel('📋 Liste')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ch:add:${userId}`)
      .setLabel('➕ Hinzufügen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ch:remove:${userId}`)
      .setLabel('❌ Entfernen')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ch:move:${userId}`)
      .setLabel('🔀 Verschieben')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin:main:${userId}`)
      .setLabel('⬅️ Admin-Menü')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

async function showMaintenanceMenu(interaction, userId) {
  const embed = new EmbedBuilder()
    .setTitle('🧹 WARTUNG')
    .setColor(0x3498DB);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`maint:health:${userId}`)
      .setLabel('🩺 Kategorie-Gesundheit')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`maint:w2g_test:${userId}`)
      .setLabel('🔌 W2G-API testen')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:main:${userId}`)
      .setLabel('⬅️ Admin-Menü')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

// ==================== TV FLOW HELPERS ====================
async function showStrategySelection(interaction, session, userId) {
  const selectedCats = session.selectedCategories || [];
  const embed = new EmbedBuilder()
    .setTitle('🎲 QUEUE REIHENFOLGE')
    .setDescription(
      `**Watchtime:** ${session.watchtime} Min\n` +
      `**Kategorien:** ${selectedCats.join(', ')}\n\n` +
      `Wie sollen die Videos angeordnet werden?`
    )
    .setColor(0x5865F2)
    .addFields(
      {
        name: '🔀 Shuffle (Zufällig gemischt)',
        value: 'Videos werden nach Gewichtung zufällig gemischt.\nGute Abwechslung zwischen allen Kategorien.',
        inline: false
      },
      {
        name: '📦 Kategorie Blocks',
        value: 'Videos werden blockweise nach Kategorien sortiert.\nErst alle Videos einer Kategorie, dann die nächste.',
        inline: false
      }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv:strategy:shuffle:${userId}`)
      .setLabel('🔀 Shuffle')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`tv:strategy:category_blocks:${userId}`)
      .setLabel('📦 Kategorie Blocks')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv:strategy_back:${userId}`)
      .setLabel('⬅️ Zurück')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

async function showQueuePreview(interaction, session, userId) {
  try {
    await interaction.editReply({ content: '⏳ Erstelle Vorschau...' });

    const categoryVideos = session.categoryVideos || {};
    const selectedCats = session.selectedCategories || [];
    const watchtime = session.watchtime;

    // Build queue preview (same logic as actual build)
    const categoryMap = {};
    for (const catName of selectedCats) {
      if (categoryVideos[catName]) {
        const allCats = await categories.getCategories();
        // Tag videos with category name
        const taggedVideos = categoryVideos[catName].videos.map(v => ({ ...v, category: catName }));
        categoryMap[catName] = {
          weight: allCats[catName]?.weight ?? 1,
          videos: taggedVideos
        };
      }
    }

    const queueResult = await buildWeightedQueue(categoryMap, watchtime, 15, { strategy: session.strategy || 'shuffle' });
    
    if (queueResult.queue.length === 0) {
      await interaction.editReply({ 
        content: '❌ Keine Videos passen in die Watchtime-Begrenzung',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`tv:confirm_back:${userId}`)
              .setLabel('⬅️ Zurück')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return;
    }

    // Store queue in session for actual push
    session.queueResult = queueResult;

    // Show preview embed
    const strategyLabel = session.strategy === 'category_blocks' ? '📦 Kategorie Blocks' : '🔀 Shuffle';
    const embed = new EmbedBuilder()
      .setTitle('🎬 QUEUE VORSCHAU')
      .setDescription(`Bereit zum Pushen zu Watch2Gether\n**Strategie:** ${strategyLabel}`)
      .setColor(0xF0B132)
      .addFields(
        { name: '📹 Videos', value: `${queueResult.queue.length}`, inline: true },
        { name: '⏱️ Gesamtdauer', value: `${queueResult.totalMinutes} Min`, inline: true },
        { name: '🎯 Ziel', value: `${queueResult.targetMinutes} Min`, inline: true }
      );

    // Add video list (max 10)
    const videoList = queueResult.queue.slice(0, 10).map((v, i) => {
      const mins = Math.round(v.duration / 60);
      return `${i + 1}. ${v.title} (${mins} Min)`;
    }).join('\n');
    
    const moreVideos = queueResult.queue.length > 10 ? `\n... und ${queueResult.queue.length - 10} weitere` : '';
    
    embed.addFields({
      name: '📋 Videos in der Queue',
      value: videoList + moreVideos,
      inline: false
    });

    // Category distribution
    const catDistribution = {};
    for (const video of queueResult.queue) {
      const cat = video.category || 'Unbekannt';
      catDistribution[cat] = (catDistribution[cat] || 0) + 1;
    }
    
    const catStats = Object.entries(catDistribution)
      .map(([cat, count]) => `• ${cat}: ${count} Videos`)
      .join('\n');
    
    embed.addFields({
      name: '📊 Verteilung',
      value: catStats,
      inline: false
    });

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tv:confirm_push:${userId}`)
        .setLabel('🚀 Zu W2G pushen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`tv:confirm_back:${userId}`)
        .setLabel('⬅️ Strategie ändern')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ 
      content: null,
      embeds: [embed], 
      components: [buttonRow] 
    });
  } catch (error) {
    console.error(`❌ Fehler bei Queue-Vorschau: ${error.message}`);
    await interaction.editReply({ 
      content: `❌ Fehler: ${error.message}`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tv:confirm_back:${userId}`)
            .setLabel('⬅️ Zurück')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }
}

async function showCategorySelection(interaction, session, userId) {
  const categoryVideos = session.categoryVideos || {};
  const categoryNames = Object.keys(categoryVideos);
  const selected = session.selectedCategories || [];

  const embed = new EmbedBuilder()
    .setTitle('📁 KATEGORIEN AUSWÄHLEN')
    .setDescription(`Watchtime: **${session.watchtime} Min**\n\nWähle mindestens eine Kategorie:`)
    .setColor(0x5865F2);

  // Show categories with their stats
  const fields = [];
  for (const catName of categoryNames) {
    const data = categoryVideos[catName];
    const isSelected = selected.includes(catName);
    const marker = isSelected ? '✅' : '⭕';
    fields.push({
      name: `${marker} ${catName}`,
      value: `${data.count} Videos • ${data.minutes} Min`,
      inline: false
    });
  }

  embed.addFields(fields);

  // Buttons for category selection
  const categoryButtons = categoryNames.map(catName => {
    const isSelected = selected.includes(catName);
    return new ButtonBuilder()
      .setCustomId(`tv:category:${encodeURIComponent(catName)}:${userId}`)
      .setLabel(catName)
      .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary);
  });

  const rows = [];
  for (let i = 0; i < categoryButtons.length; i += 2) {
    rows.push(new ActionRowBuilder().addComponents(
      categoryButtons.slice(i, i + 2)
    ));
  }

  // Control buttons
  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv:category_next:${userId}`)
      .setLabel('✅ Weiter')
      .setStyle(ButtonStyle.Success)
      .setDisabled(selected.length === 0),
    new ButtonBuilder()
      .setCustomId(`tv:category_back:${userId}`)
      .setLabel('◀️ Zurück')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(controlRow);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function buildAndPushQueue(interaction, session, userId) {
  try {
    console.log(`    🏗️ Queue Push Started`);
    await interaction.editReply({ content: '⏳ Pushe zu Watch2Gether...' });

    // Use pre-built queue from session (from preview)
    const queueResult = session.queueResult;
    
    if (!queueResult || queueResult.queue.length === 0) {
      console.warn(`      ⚠️ Keine Queue vorhanden!`);
      await interaction.editReply({ 
        content: '❌ Keine Queue gefunden',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`nav:main:${userId}`)
              .setLabel('⬅️ Hauptmenü')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return;
    }

    console.log(`      📋 Queue: ${queueResult.queue.length} Videos, ${queueResult.totalMinutes}/${queueResult.targetMinutes} Min`);

    // Push to W2G
    console.log(`    📤 Push zu Watch2Gether...`);
    const w2gItems = queueResult.queue.map(video => ({
      url: w2g.createYouTubeUrl(video.id),
      title: video.title
    }));

    await w2g.pushVideosToW2G(w2gItems);
    console.log(`      ✅ W2G Push erfolgreich`);

    // Mark as seen
    const videoIds = queueResult.queue.map(v => v.id);
    await history.markVideosSeen(videoIds);
    console.log(`      ✅ ${videoIds.length} Videos als gesehen markiert`);

    // Result
    const w2gRoomUrl = w2g.getW2GRoomUrl();
    const resultEmbed = new EmbedBuilder()
      .setTitle('✅ ERFOLGREICH GEPUSHT!')
      .setColor(0x57F287)
      .addFields(
        { name: '📹 Videos', value: `${queueResult.queue.length}`, inline: true },
        { name: '⏱️ Gesamtminuten', value: `${queueResult.totalMinutes}`, inline: true },
        { name: '🎯 Ziel-Watchtime', value: `${queueResult.targetMinutes} Min`, inline: true }
      );

    if (w2gRoomUrl) {
      resultEmbed.addFields({
        name: '🔗 Watch2Gether Raum',
        value: w2gRoomUrl,
        inline: false
      });
    }

    const resultRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tv:result_again:${userId}`)
        .setLabel('🔁 Erneut starten')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv:result_main:${userId}`)
        .setLabel('⬅️ Hauptmenü')
        .setStyle(ButtonStyle.Secondary)
    );

    // Add W2G room button if URL is available
    const components = [resultRow];
    if (w2gRoomUrl) {
      const w2gRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setURL(w2gRoomUrl)
          .setLabel('🎬 Zum Watch2Gether Raum')
          .setStyle(ButtonStyle.Link)
      );
      components.push(w2gRow);
    }

    await interaction.editReply({ embeds: [resultEmbed], components });
    clearSession(userId);
    console.log(`  📺 === TV START FLOW COMPLETED ===\n`);
  } catch (error) {
    console.error(`❌ Fehler beim Build/Push: ${error.message}`);
    console.error(error.stack);
    await interaction.editReply({ 
      content: `❌ Fehler: ${error.message}`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`nav:main:${userId}`)
            .setLabel('⬅️ Hauptmenü')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }
}

// ==================== MAINTENANCE HANDLERS ====================
async function handleCategoryHealth(interaction, userId) {
  try {
    await interaction.editReply({ content: '🩺 Prüfe Kategorie-Gesundheit...' });

    const allCategories = await categories.getCategories();
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;

    const lines = [];
    for (const [catName, catData] of Object.entries(allCategories)) {
      const channels = catData.channels || {};
      const channelIds = Object.keys(channels);

      if (channelIds.length === 0) {
        lines.push(`⚠️ ${catName} — Keine Kanäle`);
        continue;
      }

      let latestDate = null;
      const videoPromises = channelIds.map(async (channelId) => {
        try {
          return await youtube.getChannelVideos(channelId, 50);
        } catch {
          console.warn(`⚠️ Fehler für ${channelId}`);
          return null;
        }
      });

      const results = await Promise.all(videoPromises);
      for (const vids of results) {
        for (const v of vids || []) {
          if (!v.publishedAt) continue;
          const p = new Date(v.publishedAt);
          if (isNaN(p.getTime())) continue;
          if (!latestDate || p > latestDate) latestDate = p;
        }
      }

      if (!latestDate) {
        lines.push(`❌ ${catName} — Keine Videos`);
      } else {
        const daysAgo = Math.floor((now - latestDate) / dayInMs);
        if (daysAgo <= 7) {
          lines.push(`✅ ${catName} — Aktiv (${daysAgo}d ago)`);
        } else if (daysAgo <= 30) {
          lines.push(`⚠️ ${catName} — ${daysAgo} Tage`);
        } else {
          lines.push(`❌ ${catName} — ${daysAgo} Tage (inaktiv)`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🩺 KATEGORIE-GESUNDHEIT')
      .setDescription(lines.join('\n') || 'Keine Kategorien')
      .setColor(0x3498DB);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:maintenance:${userId}`)
        .setLabel('⬅️ Wartung')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('❌ Health-Check Fehler:', error);
    await interaction.editReply({ content: `❌ ${error.message}` });
  }
}

async function handleW2GTest(interaction, userId) {
  try {
    await interaction.editReply({ content: '🔌 Teste W2G-Verbindung...' });

    const result = await w2g.testW2GConnection();
    const embed = new EmbedBuilder()
      .setTitle(result.success ? '✅ W2G VERBINDUNG OK' : '❌ W2G FEHLER')
      .setDescription(result.message)
      .setColor(result.success ? 0x57F287 : 0xED4245);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:maintenance:${userId}`)
        .setLabel('⬅️ Wartung')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('❌ W2G Test Fehler:', error);
    await interaction.editReply({ content: `❌ ${error.message}` });
  }
}

async function handleW2GPlaylist(interaction, userId) {
  try {
    await interaction.editReply({ content: '📋 Lade Playlist...' });

    const result = await w2g.getCurrentPlaylist();
    const items = result.items ?? [];

    const embed = new EmbedBuilder()
      .setTitle('📺 WATCH2GETHER PLAYLIST')
      .setColor(0x5865F2);

    if (!items || items.length === 0) {
      embed.setDescription('📭 Playlist ist leer');
    } else {
      const list = items.slice(0, 20).map((it, idx) => {
        const title = it.title || it.name || 'Video ' + (idx + 1);
        return `**${idx + 1}.** ${title}`;
      }).join('\n');
      
      embed.setDescription(list);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:maintenance:${userId}`)
        .setLabel('⬅️ Wartung')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('❌ Playlist Fehler:', error);
    await interaction.editReply({ content: `❌ ${error.message}` });
  }
}

// ==================== CATEGORY ADMIN HANDLERS ====================
async function handleCategoryAdminAction(interaction, action, params, userId) {
  switch (action) {
    case 'cat:menu':
      await showCategoryAdminMenu(interaction, userId);
      break;

    case 'cat:list': {
      const allCats = await categories.getCategories();
      const catList = Object.keys(allCats).length > 0
        ? Object.keys(allCats).map(c => `• ${c}`).join('\n')
        : '📭 Keine Kategorien';
      
      const embed1 = new EmbedBuilder()
        .setTitle('📂 KATEGORIEN-LISTE')
        .setDescription(catList)
        .setColor(0xF0B132);
      
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cat:menu:${userId}`)
          .setLabel('⬅️ Kategorien')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await interaction.editReply({ embeds: [embed1], components: [row1] });
      break;
    }

    case 'cat:add': {
      const addModal = new ModalBuilder()
        .setCustomId(`cat_add_modal_${userId}`)
        .setTitle('Neue Kategorie');

      addModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('category_name')
            .setLabel('Kategorie-Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.showModal(addModal);
      break;
    }

    case 'cat:delete': {
      const delCats = await categories.getCategories();
      if (Object.keys(delCats).length === 0) {
        await interaction.editReply({ 
          content: '📭 Keine Kategorien zum Löschen',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`cat:menu:${userId}`)
                .setLabel('⬅️ Kategorien')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
        break;
      }

      const delSelect = new StringSelectMenuBuilder()
        .setCustomId(`cat:delete_select:${userId}`)
        .setPlaceholder('Wähle Kategorie zum Löschen')
        .addOptions(Object.keys(delCats).map(name => ({
          label: name,
          value: encodeURIComponent(name)
        })));

      const delRow = new ActionRowBuilder().addComponents(delSelect);
      const delEmbed = new EmbedBuilder()
        .setTitle('🗑️ KATEGORIE LÖSCHEN')
        .setColor(0xED4245);

      await interaction.editReply({ embeds: [delEmbed], components: [delRow] });
      break;
    }

    case 'cat:rename': {
      const renCats = await categories.getCategories();
      if (Object.keys(renCats).length === 0) {
        await interaction.editReply({ 
          content: '📭 Keine Kategorien zum Umbenennen',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`cat:menu:${userId}`)
                .setLabel('⬅️ Kategorien')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
        break;
      }

      const renSelect = new StringSelectMenuBuilder()
        .setCustomId(`cat:rename_select:${userId}`)
        .setPlaceholder('Wähle Kategorie zum Umbenennen')
        .addOptions(Object.keys(renCats).map(name => ({
          label: name,
          value: encodeURIComponent(name)
        })));

      const renRow = new ActionRowBuilder().addComponents(renSelect);
      const renEmbed = new EmbedBuilder()
        .setTitle('✏️ KATEGORIE UMBENENNEN')
        .setColor(0xF0B132);

      await interaction.editReply({ embeds: [renEmbed], components: [renRow] });
      break;
    }
  }
}

// ==================== CHANNEL ADMIN HANDLERS ====================
async function handleChannelAdminAction(interaction, action, params, userId) {
  switch (action) {
    case 'ch:list': {
      const allCats = await categories.getCategories();
      const chLines = [];
      
      for (const [catName, catData] of Object.entries(allCats)) {
        chLines.push(`**${catName}:**`);
        const chs = catData.channels || {};
        if (Object.keys(chs).length === 0) {
          chLines.push('  *(keine Channels)*');
        } else {
          for (const [chId, chData] of Object.entries(chs)) {
            chLines.push(`  • ${chData.name || chId}`);
          }
        }
      }

      const chEmbed = new EmbedBuilder()
        .setTitle('📺 CHANNELS-LISTE')
        .setDescription(chLines.join('\n') || '📭 Keine Channels')
        .setColor(0xF0B132);

      const chRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin:channels:${userId}`)
          .setLabel('⬅️ Channels')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [chEmbed], components: [chRow] });
      break;
    }

    case 'ch:add': {
      const addChModal = new ModalBuilder()
        .setCustomId(`ch_add_modal_${userId}`)
        .setTitle('Channel hinzufügen');

      addChModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('YouTube Channel (URL, @handle oder ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('z.B. https://youtube.com/@user oder UCxxxxx')
        )
      );

      await interaction.showModal(addChModal);
      break;
    }

    case 'ch:remove': {
      const remCats = await categories.getCategories();
      const remChs = [];

      for (const [catName, catData] of Object.entries(remCats)) {
        const chs = catData.channels || {};
        for (const [chId, chData] of Object.entries(chs)) {
          remChs.push({
            label: `${catName} - ${chData.name || chId}`,
            value: `${encodeURIComponent(catName)}:${chId}`
          });
        }
      }

      if (remChs.length === 0) {
        await interaction.editReply({ 
          content: '📭 Keine Channels zum Entfernen',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`admin:channels:${userId}`)
                .setLabel('⬅️ Channels')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
        break;
      }

      const remSelect = new StringSelectMenuBuilder()
        .setCustomId(`ch:remove_select:${userId}`)
        .setPlaceholder('Wähle Channel zum Entfernen')
        .addOptions(remChs);

      const remRow = new ActionRowBuilder().addComponents(remSelect);
      const remEmbed = new EmbedBuilder()
        .setTitle('❌ CHANNEL ENTFERNEN')
        .setColor(0xED4245);

      await interaction.editReply({ embeds: [remEmbed], components: [remRow] });
      break;
    }

    case 'ch:move': {
      const movCats = await categories.getCategories();
      const movChs = [];

      for (const [catName, catData] of Object.entries(movCats)) {
        const chs = catData.channels || {};
        for (const [chId, chData] of Object.entries(chs)) {
          movChs.push({
            label: `${catName} - ${chData.name || chId}`,
            value: `${encodeURIComponent(catName)}:${chId}`
          });
        }
      }

      if (movChs.length === 0) {
        await interaction.editReply({ 
          content: '📭 Keine Channels zum Verschieben',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`admin:channels:${userId}`)
                .setLabel('⬅️ Channels')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
        break;
      }

      const movSelect = new StringSelectMenuBuilder()
        .setCustomId(`ch:move_select:${userId}`)
        .setPlaceholder('Wähle Channel zu verschieben')
        .addOptions(movChs);

      const movRow = new ActionRowBuilder().addComponents(movSelect);
      const movEmbed = new EmbedBuilder()
        .setTitle('🔀 CHANNEL VERSCHIEBEN')
        .setColor(0x3498DB);

      await interaction.editReply({ embeds: [movEmbed], components: [movRow] });
      break;
    }
  }
}

// ==================== SELECT MENU HANDLER ====================
async function handleSelectMenu(interaction, action, params) {
  const userId = params[0]; // params ist jetzt nur [userId]
  console.log(`  🐦 Security Check: Menu-User=${userId}, Requester=${interaction.user.id}`);

  if (userId !== interaction.user.id) {
    console.warn(`  ❌ SECURITY: Unauthorized select menu`);
    await safeReply(interaction, { content: '❌ Nur du kannst diese Aktion ausführen', flags: MessageFlags.Ephemeral });
    return;
  }

  // Check if this is a modal select (don't defer if modal)
  const isModalSelect = action === 'cat:rename_select';
  
  if (!isModalSelect) {
    // WICHTIG: deferUpdate() ZUERST, bevor 3 Sekunden vergehen (außer bei Modals)!
    await interaction.deferUpdate();
  }
  
  console.log(`  📊 Select Menu: ${action}, Wert: ${interaction.values.join(',')}`);

  // Category delete
  if (action === 'cat:delete_select') {
    const catName = decodeURIComponent(interaction.values[0]);
    console.log(`    🗑️ Lösche Kategorie: "${catName}"`);
    await categories.deleteCategory(catName);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ KATEGORIE GELÖSCHT')
      .setDescription(`"${catName}" wurde entfernt`)
      .setColor(0x57F287);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:categories:${userId}`)
        .setLabel('⬅️ Kategorien')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  // Category rename - select to rename
  if (action === 'cat:rename_select') {
    const oldName = decodeURIComponent(interaction.values[0]);
    console.log(`    ✏️ Rename vorbereitet: "${oldName}" → Modal`);
    const session = getSession(userId);
    session.renameFrom = oldName;

    const renModal = new ModalBuilder()
      .setCustomId(`cat_rename_modal_${userId}`)
      .setTitle('Kategorie umbenennen');

    renModal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('new_name')
          .setLabel('Neuer Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.showModal(renModal);
    return;
  }

  // Channel remove
  if (action === 'ch:remove_select') {
    const [catName, chId] = interaction.values[0].split(':');
    const decodedCat = decodeURIComponent(catName);
    console.log(`    ❌ Entferne Channel: "${chId}" aus "${decodedCat}"`);
    
    await categories.removeChannelFromCategory(decodedCat, chId);

    const embed = new EmbedBuilder()
      .setTitle('✅ CHANNEL ENTFERNT')
      .setDescription(`Channel wurde aus "${decodedCat}" entfernt`)
      .setColor(0x57F287);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:channels:${userId}`)
        .setLabel('⬅️ Channels')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  // Channel move - select to move
  if (action === 'ch:move_select') {
    const [catName, chId] = interaction.values[0].split(':');
    console.log(`    🔀 Move Channel: "${chId}" von "${decodeURIComponent(catName)}" → Zielwahl`);
    const session = getSession(userId);
    session.moveChId = chId;
    session.moveFromCat = decodeURIComponent(catName);

    const movCats = await categories.getCategories();
    const otherCats = Object.keys(movCats).filter(c => c !== session.moveFromCat);

    if (otherCats.length === 0) {
      console.warn(`    ⚠️ Keine anderen Kategorien verfügbar`);
      await interaction.editReply({ 
        content: '❌ Keine anderen Kategorien vorhanden',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`admin:channels:${userId}`)
              .setLabel('⬅️ Channels')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return;
    }

    const tgtSelect = new StringSelectMenuBuilder()
      .setCustomId(`ch:move_target:${userId}`)
      .setPlaceholder('Zielkategorie wählen')
      .addOptions(otherCats.map(name => ({
        label: name,
        value: encodeURIComponent(name)
      })));

    const tgtRow = new ActionRowBuilder().addComponents(tgtSelect);
    const tgtEmbed = new EmbedBuilder()
      .setTitle('🎯 ZIELKATEGORIE')
      .setDescription(`Verschiebe Channel nach:`)
      .setColor(0x3498DB);

    await interaction.editReply({ embeds: [tgtEmbed], components: [tgtRow] });
    return;
  }

  // Channel move - target
  if (action === 'ch:move_target') {
    const session = getSession(userId);
    const tgtCat = decodeURIComponent(interaction.values[0]);
    console.log(`    ✅ Channel verschoben: "${session.moveChId}" von "${session.moveFromCat}" → "${tgtCat}"`);

    // Channel-Daten VOR dem Entfernen speichern
    const allCats = await categories.getCategories();
    const chData = allCats[session.moveFromCat]?.channels?.[session.moveChId] || { name: session.moveChId };
    
    // Jetzt entfernen und zur Zielkategorie hinzufügen
    await categories.removeChannelFromCategory(session.moveFromCat, session.moveChId);
    await categories.addChannelToCategory(tgtCat, session.moveChId, chData.name);

    const embed = new EmbedBuilder()
      .setTitle('✅ CHANNEL VERSCHOBEN')
      .setDescription(`Channel wurde zu "${tgtCat}" verschoben`)
      .setColor(0x57F287);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:channels:${userId}`)
        .setLabel('⬅️ Channels')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  // Channel add - select category (nach Modal)
  if (action === 'ch:add_select') {
    const session = getSession(userId);
    const catName = decodeURIComponent(interaction.values[0]);
    console.log(`    ✅ Channel hinzufügen: "${session.newChName}" → "${catName}"`);

    if (!session.newChId || !session.newChName) {
      console.warn(`    ⚠️ Keine Channel-Daten in Session!`);
      await interaction.editReply({ content: '❌ Fehler: Keine Channel-Daten gefunden' });
      return;
    }

    try {
      await categories.addChannelToCategory(catName, session.newChId, session.newChName);
      console.log(`      ✅ Channel hinzugefügt`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ CHANNEL HINZUGEFÜGT')
        .setDescription(`"${session.newChName}" zu "${catName}"`)
        .setColor(0x57F287);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin:channels:${userId}`)
          .setLabel('⬅️ Channels')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(`      ❌ Fehler: ${error.message}`);
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
    return;
  }

  console.warn(`  ⚠️ Unbekannte Select-Action: ${action}`);
}

// ==================== MODAL SUBMIT HANDLER ====================
async function handleModalSubmit(interaction, action, params) {
  // WICHTIG: deferUpdate() ZUERST, bevor 3 Sekunden vergehen!
  await interaction.deferUpdate();
  
  const userId = params[params.length - 1];
  console.log(`  📋 Modal Submit: ${action} von ${interaction.user.username}`);

  if (userId !== interaction.user.id) {
    console.warn(`  ❌ SECURITY: Unauthorized modal submit`);
    await interaction.followUp({ content: '❌ Nur du kannst diese Aktion ausführen', flags: MessageFlags.Ephemeral });
    return;
  }

  const session = getSession(userId);

  if (action === 'tv_watchtime_modal') {
    const minutes = parseInt(interaction.fields.getTextInputValue('minutes'));
    console.log(`    ⏱️ Custom Watchtime: ${minutes} Min`);
    
    if (isNaN(minutes) || minutes <= 0) {
      console.warn(`    ⚠️ Ungültige Eingabe: ${minutes}`);
      await interaction.editReply({ content: '❌ Bitte gib eine gültige Zahl ein' });
      return;
    }

    session.watchtime = minutes;
    session.step = 'categories';
    await showCategorySelection(interaction, session, userId);
    return;
  }

  if (action === 'cat_add_modal') {
    const name = interaction.fields.getTextInputValue('category_name').trim();
    console.log(`    ➕ Neue Kategorie: "${name}"`);
    
    if (!name) {
      console.warn(`    ⚠️ Name ist leer!`);
      await interaction.editReply({ content: '❌ Name darf nicht leer sein' });
      return;
    }

    try {
      await categories.addCategory(name);
      console.log(`      ✅ Kategorie erstellt`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ KATEGORIE ERSTELLT')
        .setDescription(`"${name}" wurde hinzugefügt`)
        .setColor(0x57F287);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cat:menu:${userId}`)
          .setLabel('⬅️ Kategorien')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(`      ❌ Fehler: ${error.message}`);
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
    return;
  }

  if (action === 'cat_rename_modal') {
    const newName = interaction.fields.getTextInputValue('new_name').trim();
    const oldName = session.renameFrom;
    console.log(`    ✏️ Rename: "${oldName}" → "${newName}"`);

    if (!newName) {
      console.warn(`    ⚠️ Neuer Name ist leer!`);
      await interaction.editReply({ content: '❌ Name darf nicht leer sein' });
      return;
    }

    try {
      await categories.renameCategory(oldName, newName);
      console.log(`      ✅ Kategorie umbenannt`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ KATEGORIE UMBENANNT')
        .setDescription(`"${oldName}" → "${newName}"`)
        .setColor(0x57F287);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cat:menu:${userId}`)
          .setLabel('⬅️ Kategorien')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(`      ❌ Fehler: ${error.message}`);
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
    return;
  }

  if (action === 'ch_add_modal') {
    const chInput = interaction.fields.getTextInputValue('channel_id').trim();
    console.log(`    ➕ Neuer Channel: ${chInput} → Channel-ID auflösen...`);

    if (!chInput) {
      console.warn(`    ⚠️ Channel-Eingabe ist leer!`);
      await interaction.editReply({ content: '❌ Channel-ID oder URL erforderlich' });
      return;
    }

    // Channel-ID auflösen (unterstützt URLs, @handles, IDs)
    let chId;
    try {
      chId = await youtube.resolveChannelId(chInput);
      console.log(`    ✅ Channel-ID aufgelöst: ${chId}`);
    } catch (error) {
      console.error(`    ❌ Channel-ID Auflösung fehlgeschlagen: ${error.message}`);
      await interaction.editReply({ content: '❌ Channel konnte nicht aufgelöst werden. Überprüfe die Eingabe.' });
      return;
    }

    // Channel-Namen von YouTube API holen
    let chName;
    try {
      const channelInfo = await youtube.getChannelInfo(chId);
      if (!channelInfo) {
        await interaction.editReply({ content: '❌ Channel nicht gefunden. Überprüfe die Channel-ID.' });
        return;
      }
      chName = channelInfo.name;
      console.log(`    ✅ Channel-Name gefunden: "${chName}"`);
    } catch (error) {
      console.error(`    ❌ YouTube API Fehler: ${error.message}`);
      await interaction.editReply({ content: '❌ Fehler beim Abrufen der Channel-Daten von YouTube.' });
      return;
    }

    // Channel-Daten in Session speichern
    session.newChId = chId;
    session.newChName = chName;

    // Kategorien laden und Dropdown anzeigen
    const allCats = await categories.getCategories();
    if (Object.keys(allCats).length === 0) {
      await interaction.editReply({ 
        content: '📭 Keine Kategorien vorhanden. Erstelle zuerst eine Kategorie.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`admin:channels:${userId}`)
              .setLabel('⬅️ Channels')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return;
    }

    const catSelect = new StringSelectMenuBuilder()
      .setCustomId(`ch:add_select:${userId}`)
      .setPlaceholder('Wähle Kategorie für den Channel')
      .addOptions(Object.keys(allCats).map(name => ({
        label: name,
        value: encodeURIComponent(name)
      })));

    const catRow = new ActionRowBuilder().addComponents(catSelect);
    const catEmbed = new EmbedBuilder()
      .setTitle('📂 KATEGORIE WÄHLEN')
      .setDescription(`Channel: **${chName}** (${chId})`)
      .setColor(0x3498DB);

    await interaction.editReply({ embeds: [catEmbed], components: [catRow] });
    return;
  }

  // Channel add - select category (nach Modal)
  if (action === 'ch:add_select') {
    const catName = decodeURIComponent(interaction.values[0]);
    console.log(`    ✅ Channel hinzufügen: "${session.newChName}" → "${catName}"`);

    if (!session.newChId || !session.newChName) {
      console.warn(`    ⚠️ Keine Channel-Daten in Session!`);
      await interaction.editReply({ content: '❌ Fehler: Keine Channel-Daten gefunden' });
      return;
    }

    try {
      await categories.addChannelToCategory(catName, session.newChId, session.newChName);
      console.log(`      ✅ Channel hinzugefügt`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ CHANNEL HINZUGEFÜGT')
        .setDescription(`"${session.newChName}" zu "${catName}"`)
        .setColor(0x57F287);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin:channels:${userId}`)
          .setLabel('⬅️ Channels')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(`      ❌ Fehler: ${error.message}`);
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
    return;
  }

  console.warn(`  ⚠️ Unbekannte Modal-Action: ${action}`);
}

// ==================== LOGIN ====================
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startApplication().catch(error => {
    console.error('❌ Fehler beim Starten der Anwendung:', error);
    process.exit(1);
  });
}

export { startApplication, app, client, config };