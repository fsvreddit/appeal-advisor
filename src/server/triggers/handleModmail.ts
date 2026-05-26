import { OnModMailRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { context, GetConversationResponse, reddit, scheduler } from "@devvit/web/server";
import { handleAppeal, isUserBanned, ModmailMessage, SendModmailAsyncData } from "../core";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { SchedulerJob } from "../scheduler";
import { addSeconds } from "date-fns";

async function handleAppMention (message: ModmailMessage): Promise<TriggerResponse> {
    const userMessage = message.messagesInConversation.find(msg => msg.author?.name === message.participant);
    if (!userMessage?.bodyMarkdown) {
        return { message: "No message from participant found in conversation." };
    }

    if (!await isUserBanned(message.participant)) {
        await reddit.modMail.reply({
            conversationId: message.conversationId,
            body: `u/${message.participant} is not currently banned from r/${context.subredditName} so appeal analysis is not necessary.`,
            isInternal: true,
        });
        return { message: "participant is not banned" };
    }

    const moderators = await reddit.getModerators({
        subredditName: context.subredditName,
        username: message.messageAuthor,
    }).all();

    if (moderators.length === 0) {
        return { message: "message author is not a moderator" };
    }

    return await handleAppeal(userMessage.bodyMarkdown, message);
}

export const handleModmail = async (c: Context) => {
    const modmailRequest = await c.req.json<OnModMailRequest>();

    if (modmailRequest.messageAuthor?.name === context.appSlug) {
        return c.json<TriggerResponse>({ message: "ignoring message sent by the app itself" }, 200);
    }

    if (modmailRequest.conversationType !== "sr_user") {
        return c.json<TriggerResponse>({ message: "conversation is not a user conversation" }, 200);
    }

    if (await hasTriggerBeenHandled(`modmail:${modmailRequest.messageId}`)) {
        return c.json<TriggerResponse>({ message: "modmail message has already been handled" }, 200);
    }

    let conversation: GetConversationResponse;
    try {
        conversation = await reddit.modMail.getConversation({ conversationId: modmailRequest.conversationId });
        if (!conversation.conversation) {
            console.error(`${modmailRequest.messageId}: Conversation ${modmailRequest.conversationId} not found`);
            return c.json<TriggerResponse>({ message: "conversation not found" }, 404);
        }
    } catch (error) {
        console.error(`${modmailRequest.messageId}: Error fetching conversation ${modmailRequest.conversationId}`, error);
        console.log(JSON.stringify(modmailRequest, null, 2));
        return c.json<TriggerResponse>({ message: "error fetching conversation" }, 500);
    }

    if (!conversation.conversation.participant?.name) {
        console.log(`${modmailRequest.messageId}: Conversation participant not found for conversation ${modmailRequest.conversationId}`);
        return c.json<TriggerResponse>({ message: "conversation participant not found" }, 200);
    }

    const messagesInConversation = Object.values(conversation.conversation.messages);
    const currentMessage = messagesInConversation.find(message => message.id && modmailRequest.messageId.includes(message.id));
    if (!currentMessage?.bodyMarkdown) {
        console.error(`${modmailRequest.messageId}: Current message not found`);
        return c.json<TriggerResponse>({ message: "current message not found" }, 400);
    }

    const modmailMessage: ModmailMessage = {
        conversationId: modmailRequest.conversationId,
        participant: conversation.conversation.participant.name,
        messageId: modmailRequest.messageId,
        messageAuthor: currentMessage.author?.name ?? "unknown",
        messageBody: currentMessage.bodyMarkdown.trim(),
        messagesInConversation,
    };

    if (currentMessage.bodyMarkdown.includes("u/" + context.appSlug)) {
        return c.json(await handleAppMention(modmailMessage), 200);
    }

    if (currentMessage.author?.name !== modmailMessage.participant) {
        return c.json<TriggerResponse>({ message: "message author is not the participant" }, 200);
    }

    if (!await isUserBanned(modmailMessage.participant)) {
        return c.json<TriggerResponse>({ message: "participant is not banned" }, 200);
    }

    const firstMessageFromParticipant = messagesInConversation.find(message => message.author?.name === modmailMessage.participant);
    if (firstMessageFromParticipant?.id !== currentMessage.id) {
        return c.json<TriggerResponse>({ message: "ignoring message because it's not the first message from the participant" }, 200);
    }

    if (!firstMessageFromParticipant?.bodyMarkdown) {
        return c.json<TriggerResponse>({ message: "first message from participant has no body" }, 200);
    }

    const data: SendModmailAsyncData = {
        conversationId: modmailMessage.conversationId,
        message: [
            `u/${modmailMessage.participant} is currently **banned** on r/${context.subredditName}.`,
            `If you would like Appeal Advisor to analyze this user's appeal, reply to this message with a private note that mentions me in the form \`u/${context.appSlug}\`.`,
            "I'll then respond with an analysis of the user's appeal taking into account their recent history, subreddit rules and mod notes.",
        ].join("\n\n"),
    };

    await scheduler.runJob({
        name: SchedulerJob.SendModmailAsync,
        runAt: addSeconds(new Date(), 10),
        data,
    });

    return c.json<TriggerResponse>(await handleAppeal(firstMessageFromParticipant.bodyMarkdown, modmailMessage), 200);
};
