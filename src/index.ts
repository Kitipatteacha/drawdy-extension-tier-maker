import { DriverModule, DriverSubscriptionEvent } from "@drawdy/driver-protocol";

import {
  addImages,
  insertAtViewportCenter,
  normalizeTable,
  resetTable,
  updateTable,
} from "./actions/tables";
import { drag } from "./actions/drag/machine";
import { noteUpdated, reflowResized } from "./actions/reflow";
import { TIERMAKER_SVG } from "./panel/icon";
import { sanitizeConfig } from "./table/config";
import { enqueue } from "./drawdy-bridge/queue";
import {
  command,
  isOpen,
  open,
  post,
  session,
  updateStyling,
} from "./drawdy-bridge/session";
import { loadConfig, saveConfig } from "./drawdy-bridge/storage";
import {
  boundTable,
  design,
  handleSelection,
  showDesign,
  stylingCssVars,
} from "./panel/binding";
import { WEBVIEW_HTML } from "./panel/html";
import { WebviewToDriver } from "./panel/messages";

const SUBSCRIPTIONS = [
  "subscription:dom:theme-changed",
  "subscription:scene:drawdy-element-selection",
  "subscription:scene:drawdy-elements-dragged",
] as const;

export const activate: DriverModule["activate"] = async ({
  manifest,
  issueCommand,
  styling,
  generateId,
}) => {
  open({
    manifest,
    issueCommand,
    styling,
    generateId,
    actionButtonId: `${manifest.driverId}:action-button`,
    webviewId: `${manifest.driverId}:webview`,
  });

  const button = await command("command:dom:create-action-button", {
    domElementId: session().actionButtonId,
    svg: TIERMAKER_SVG,
  });
  if (!button?.created) return;

  for (const type of SUBSCRIPTIONS) await command(type);
  await command("subscription:scene:elements-updated", {
    properties: ["meta", "width", "height"],
  });
  await command("subscription:dom:element-clicked", {
    domElementId: session().actionButtonId,
  });
  await command("subscription:webview:message", {
    webviewDomId: session().webviewId,
  });

  try {
    const saved = await loadConfig();
    if (saved) showDesign(saved);
  } catch {
    // An unreadable store just means the default table.
  }
};

export const onEvent: DriverModule["onEvent"] = async (e) => {
  if (!isOpen()) return;
  switch (e.type) {
    case "subscription:dom:theme-changed": {
      updateStyling(e.body.styling);
      post({
        type: "styling",
        css: stylingCssVars(e.body.styling),
      });
      return;
    }
    case "subscription:dom:element-clicked": {
      if (e.body.domElementId !== session().actionButtonId) return;
      await command("command:webview:create", {
        webviewDomId: session().webviewId,
        htmlContent: WEBVIEW_HTML.replace(
          "/*__DRAWDY_STYLING__*/",
          stylingCssVars(session().styling),
        ),
        keepStateWhenClosed: true,
      });
      return;
    }
    case "subscription:scene:elements-updated": {
      noteUpdated(e.body.drawdyElements);
      return;
    }
    case "subscription:scene:drawdy-element-selection": {
      enqueue(reflowResized);
      enqueue(() => handleSelection(e.body.drawdyElementIds));
      return;
    }
    case "subscription:scene:drawdy-elements-dragged": {
      onDrag(e.body);
      return;
    }
    case "subscription:webview:message": {
      if (e.body.webviewDomId !== session().webviewId) return;
      const message = e.body.message;
      if (typeof message !== "object" || message === null) return;
      await handleWebviewMessage(message as WebviewToDriver);
      return;
    }
    default:
      return;
  }
};

type DragEvent = Extract<
  DriverSubscriptionEvent,
  { type: "subscription:scene:drawdy-elements-dragged" }
>["body"];

function onDrag(body: DragEvent): void {
  switch (body.type) {
    case "dragStart": {
      const ids = body.drawdyElementIds;
      enqueue(() => drag.dragStart(ids));
      return;
    }
    case "dragging": {
      if (drag.claimTick()) enqueue(() => drag.dragging());
      return;
    }
    case "dragEnd":
      enqueue(() => drag.dragEnd());
  }
}

async function handleWebviewMessage(message: WebviewToDriver): Promise<void> {
  switch (message.type) {
    case "ready": {
      post({
        type: "init",
        config: design(),
        css: stylingCssVars(session().styling),
      });
      return;
    }
    case "insert": {
      const next = sanitizeConfig(message.config);
      showDesign(next);
      enqueue(() => insertAtViewportCenter(next));
      return;
    }
    case "update": {
      const next = sanitizeConfig(message.config);
      showDesign(next);
      enqueue(() => updateTable(message.tableId, next));
      return;
    }
    case "add-images": {
      const images = Array.isArray(message.images) ? message.images : [];
      const tableId = message.tableId ?? boundTable();
      enqueue(() => addImages(tableId, images));
      return;
    }
    case "normalize": {
      const tableId = message.tableId ?? boundTable();
      enqueue(() => normalizeTable(tableId));
      return;
    }
    case "reset": {
      const tableId = message.tableId ?? boundTable();
      enqueue(() => resetTable(tableId));
      return;
    }
    case "save-config": {
      showDesign(sanitizeConfig(message.config));
      try {
        await saveConfig(design());
      } catch {
        // Losing the remembered design only costs the next open its head start.
      }
      return;
    }
  }
}
