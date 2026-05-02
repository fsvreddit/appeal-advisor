import { Context } from "hono";
import { cleanupDeletedAccounts } from "../core";
import { ScheduledCronJob } from "@devvit/web/server";

export const handleCleanupDeletedAccounts = async (c: Context) => {
    const request = await c.req.json<ScheduledCronJob>();

    const fromCron = request.data?.fromCron as boolean | undefined ?? false;
    await cleanupDeletedAccounts(fromCron);

    return c.json({ message: "cleanup of deleted accounts complete" }, 200);
};
