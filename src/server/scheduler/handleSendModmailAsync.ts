import { Context } from "hono";
import { SendModmailAsyncData } from "../core";
import { reddit, TaskRequest, TaskResponse } from "@devvit/web/server";

export const handleSendModmailAsync = async (c: Context) => {
    const request = await c.req.json<TaskRequest<SendModmailAsyncData>>();

    await reddit.modMail.reply({
        conversationId: request.data.conversationId,
        body: request.data.message,
        isAuthorHidden: request.data.isAuthorHidden,
    });

    return c.json<TaskResponse>({ message: "modmail message sent successfully" }, 200);
};
