import { Context } from "hono";
import { cleanupDeletedAccounts } from "../core";
import { TaskRequest, TaskResponse } from "@devvit/web/server";

export const handleCleanupDeletedAccounts = async (c: Context) => {
    const request = await c.req.json<TaskRequest<{ fromCron: boolean }>>();

    await cleanupDeletedAccounts(request.data.fromCron);

    return c.json<TaskResponse>({ message: "cleanup of deleted accounts complete" }, 200);
};
