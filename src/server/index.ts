import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { handleAppInstall, handleAppUpgrade, handleModAction, handleModmail } from "./triggers";
import { setAPIKeyMenu } from "./menus";
import { handleSetAPIKeyForm } from "./forms";
import { handleCleanupDeletedAccounts } from "./scheduler";

const application = new Hono();

// Triggers
application.post("/internal/triggers/on-app-install", handleAppInstall);
application.post("/internal/triggers/on-app-upgrade", handleAppUpgrade);
application.post("/internal/triggers/on-mod-action", handleModAction);
application.post("/internal/triggers/on-modmail", handleModmail);

// Scheduler
application.post("/internal/scheduler/cleanup-deleted-accounts", handleCleanupDeletedAccounts);

// Menus
application.post("/internal/menu/set-openai-key", setAPIKeyMenu);

// Form handlers
application.post("/internal/form/set-openai-key", handleSetAPIKeyForm);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
