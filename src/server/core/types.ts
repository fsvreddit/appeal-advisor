import { MessageData } from "@devvit/web/server";

export interface ModmailMessage {
    conversationId: string;
    messageId: string;
    messageAuthor: string;
    participant: string;
    messageBody: string;
    messagesInConversation: MessageData[];
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type CallOpenAIData = {
    prompt: string;
    conversationId: string;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type CleanupDeletedAccountsData = {
    fromCron: boolean;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type SendModmailAsyncData = {
    conversationId: string;
    message: string;
    isAuthorHidden: boolean;
};
