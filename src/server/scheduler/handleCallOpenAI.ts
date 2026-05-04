import { Context } from "hono";
import { ScheduledCronJob } from "@devvit/web/server";
import { callOpenAIAndRespond } from "../core";

export const handleCallOpenAI = async (c: Context) => {
    const request = await c.req.json<ScheduledCronJob>();

    const prompt = request.data?.prompt as string | undefined;
    const conversationId = request.data?.conversationId as string | undefined;

    if (!prompt || !conversationId) {
        console.error("Missing prompt or conversationId in callOpenAI job data", { prompt, conversationId });
        return c.json({ message: "missing prompt or conversationId" }, 400);
    }

    await callOpenAIAndRespond(prompt, conversationId);
};
