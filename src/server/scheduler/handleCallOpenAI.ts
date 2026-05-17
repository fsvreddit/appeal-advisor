import { Context } from "hono";
import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { callOpenAIAndRespond } from "../core";

export const handleCallOpenAI = async (c: Context) => {
    const request = await c.req.json<TaskRequest<{
        prompt: string;
        conversationId: string;
    }>>();

    await callOpenAIAndRespond(request.data.prompt, request.data.conversationId);

    return c.json<TaskResponse>({ message: "OpenAI called and response sent" }, 200);
};
