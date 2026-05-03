import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { recordBan, removeRecordOfBan } from "../core";

export const handleModAction = async (c: Context) => {
    const request = await c.req.json<OnModActionRequest>();

    if (!request.targetUser) {
        return c.json<TriggerResponse>({ message: "mod action does not have a target user" }, 200);
    }

    if (request.action === "banuser") {
        await recordBan(request.targetUser.name);
        console.log(`Mod Action: Recorded ban for user ${request.targetUser.name}`);
    } else if (request.action === "unbanuser") {
        await removeRecordOfBan(request.targetUser.name);
        console.log(`Mod Action: Removed ban record for user ${request.targetUser.name}`);
    }

    return c.json<TriggerResponse>({ message: "mod action handled" }, 200);
};
