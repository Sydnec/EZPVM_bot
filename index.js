import "dotenv/config";

import { Client, GatewayIntentBits, Collection } from "discord.js";
import { error } from "./logger.js";

// Commandes
import * as percoCommand from "./commands/perco.js";
import * as configCommand from "./commands/config.js";

// Events
import clientReady from "./events/clientReady.js";
import interactionCreate from "./events/interactionCreate.js";
import updateLadderMessage from "./events/updateLadderMessage.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Collection des commandes
client.commands = new Collection();
client.commands.set(percoCommand.data.name, percoCommand);
client.commands.set(configCommand.data.name, configCommand);

// Exposer updateLadderMessage pour les autres modules
client.updateLadderMessage = () => updateLadderMessage(client);

// Events
client.once("clientReady", () => clientReady(client));
client.on("interactionCreate", (interaction) =>
  interactionCreate(client, interaction),
);

process.on("unhandledRejection", (reason) => {
  error("Promesse rejetée non gérée:", reason);
});

process.on("uncaughtException", (err) => {
  error("Exception non capturée:", err);
});

client.login(process.env.DISCORD_TOKEN);
