import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { handleAppInstall, handleAppUpgrade, handleModAction, handleModmail } from "./triggers";
import { setAPIKeyMenu } from "./menus";
import { handleSetAPIKeyForm } from "./forms";
import { handleCallOpenAI, handleCleanupDeletedAccounts, handlePopulateInitialBanDates, handleSendModmailAsync } from "./scheduler";
import { validateSubredditTerminology } from "./validators";

const application = new Hono();

// Triggers
application.post("/internal/triggers/on-app-install", handleAppInstall);
application.post("/internal/triggers/on-app-upgrade", handleAppUpgrade);
application.post("/internal/triggers/on-mod-action", handleModAction);
application.post("/internal/triggers/on-modmail", handleModmail);

// Scheduler
application.post("/internal/scheduler/cleanup-deleted-accounts", handleCleanupDeletedAccounts);
application.post("/internal/scheduler/populate-initial-ban-dates", handlePopulateInitialBanDates);
application.post("/internal/scheduler/call-openai", handleCallOpenAI);
application.post("/internal/scheduler/send-modmail-async", handleSendModmailAsync);

// Menus
application.post("/internal/menu/set-openai-key", setAPIKeyMenu);

// Form handlers
application.post("/internal/form/set-openai-key", handleSetAPIKeyForm);

// Settings validators
application.post("/internal/validators/subreddit-terminology", validateSubredditTerminology);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
