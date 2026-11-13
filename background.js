// Runs for as long as the extension is enabled, even when the popover is closed.
// Listens for rolls from anyone at the table, keeps a local log and shows a notification.
import { OBR, CHANNEL, addToLog } from "./shared.js";
import { summary } from "./dice.js";

OBR.onReady(() => {
  OBR.broadcast.onMessage(CHANNEL, async (event) => {
    const roll = event.data;
    if (!roll || !roll.id || !roll.result) return;
    addToLog(roll);

    // The roller already sees their own result in the popover.
    const me = await OBR.player.getId();
    if (roll.playerId === me) return;

    const variant = roll.result.ultimate || (roll.result.success && roll.result.fantastic)
      ? "SUCCESS"
      : roll.result.success === false ? "WARNING" : "DEFAULT";
    const label = roll.label ? ` (${roll.label})` : "";
    OBR.notification.show(`${roll.playerName}${label}: ${summary(roll.result)}`, variant);
  });
});
