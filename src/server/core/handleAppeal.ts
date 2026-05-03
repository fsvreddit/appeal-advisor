import { context, Post, reddit, settings } from "@devvit/web/server";
import { isT3, TriggerResponse } from "@devvit/web/shared";
import { ModmailMessage } from "./types";
import { format } from "date-fns";
import _ from "lodash";
import { getAPIKey } from "./apiKeys";
import OpenAI from "openai";
import { AppSetting } from "./appSettings";
import { getBanDate } from "./banRecording";

const basePrompt = `
You are a helpful assistant for subreddit moderators that provides advice on whether a ban appeal is likely to be successful.

You will be provided with:
* The content of the user's appeal message, which may include an explanation of why they were banned, an apology, and/or a promise to follow the rules in the future.
* The rules of the subreddit they were banned from (if any exist).
* Any notes made by moderators about the user (if any exist).
* The user's recent history across Reddit (if any history exists).

Your task is to provide advice to the moderators on whether they should approve or deny the appeal, or if there is not enough information to make a judgment.

Consider whether the user is expressing genuine remorse, taking responsibility for their actions, and demonstrating an understanding of the rules they broke. Also consider whether the user has a history of similar behavior or if this was a one-time mistake.

Also consider whether the user's behavior across Reddit generally is positive and in line with Reddit's content policy and subreddit rules. Put higher precedence on more recent activity, particularly history more recent than the ban date, if known.

Provide your advice in the following format:
* A recommendation (single line) of either "Approve", "Deny", and a confidence indicator (e.g. words such as "high confidence", "medium confidence", "low confidence").
* Reasoning (3-4 paragraphs total) that explains the recommendation in more detail, referencing specific information from the appeal message, subreddit rules, moderator notes, and user history as necessary.
`;

interface PostInfo {
    title: string;
    createdAt: Date;
    url?: string;
}

function blockquoteText (text: string): string {
    return text.split("\n").map(line => `> ${line}`).join("\n");
}

async function getUserHistoryForAppeal (username: string) {
    try {
        const user = await reddit.getUserByUsername(username);
        if (!user) {
            return;
        }

        const socialLinks = await user.getSocialLinks();

        const history = await reddit.getCommentsAndPostsByUser({
            username,
            limit: 100,
            sort: "new",
        }).all();

        const postInfoMap: Record<string, PostInfo> = {};
        const uniqueCommentPosts = _.uniq(history.filter(item => "postId" in item).map(comment => comment.postId));

        await Promise.all(uniqueCommentPosts.map(async (postId) => {
            let post: Post;
            try {
                post = await reddit.getPostById(postId);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Failed to fetch post info for postId ${postId}:`, message);
                return;
            }

            postInfoMap[postId] = {
                title: post.title,
                createdAt: post.createdAt,
                url: post.url,
            };
        }));

        return {
            userInfo: {
                ...user.toJSON(),
                socialLinks: socialLinks.map(link => ({ title: link.title, url: link.outboundUrl })),
            },
            history: history.map((item) => {
                if ("parentId" in item) {
                    return {
                        type: "comment",
                        content: item.body,
                        karma: item.score,
                        subredditName: item.subredditName,
                        createdAt: item.createdAt,
                        isTopLevel: isT3(item.parentId),
                        edited: item.edited ? true : undefined,
                        removed: item.removed ? true : undefined,
                        parentPostInfo: postInfoMap[item.postId],
                    };
                } else {
                    return {
                        type: "post",
                        title: item.title,
                        content: item.body,
                        karma: item.score,
                        subredditName: item.subredditName,
                        createdAt: item.createdAt,
                        url: item.url,
                        isPinnedToProfile: item.stickied ? true : undefined,
                        edited: item.edited ? true : undefined,
                        removed: item.removed ? true : undefined,
                        nsfw: item.nsfw ? true : undefined,
                    };
                }
            }),
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Error in getUserInfoForOpenAI for username ${username}:`, errorMessage);
    }
}

export async function handleAppeal (messageBody: string, modmailMessage: ModmailMessage): Promise<TriggerResponse> {
    console.log(`Handling appeal for conversation ${modmailMessage.conversationId} from participant ${modmailMessage.participant}`);

    const apiKeyInformation = await getAPIKey();
    if (!apiKeyInformation.apiKey) {
        await reddit.modMail.reply({
            conversationId: modmailMessage.conversationId,
            body: `Sorry, but I am currently unable to analyze this appeal because there is no API key available and you are out of free appeals for this month.`,
            isInternal: true,
        });
        console.error("No API key available to handle appeal");
        return { message: "no API key available" };
    }

    const userHistory = await getUserHistoryForAppeal(modmailMessage.participant);
    if (!userHistory) {
        console.log(`User ${modmailMessage.participant} may be shadowbanned or suspended.`);
    }

    let prompt = `${basePrompt}\n\n## User's appeal message:\n\n${blockquoteText(messageBody)}`;

    const banDate = await getBanDate(modmailMessage.participant);
    if (banDate) {
        prompt += `\n\nThe user was banned on ${format(banDate, "yyyy-MM-dd")}. This may be relevant context for evaluating the appeal.`;
    }

    const rules = await reddit.getRules(context.subredditName);
    if (rules.length > 0) {
        prompt += "\n\n## Subreddit rules:\n\n";
        for (const rule of rules) {
            prompt += `**${rule.shortName}**\n\n`;
            prompt += `${blockquoteText(rule.description)}\n\n`;
        }
    }

    const modNotes = await reddit.getModNotes({
        subreddit: context.subredditName,
        user: modmailMessage.participant,
        filter: "NOTE",
    }).all();

    if (modNotes.length > 0) {
        prompt += "\n\n## Notes about the user left by moderators:\n\n";
        for (const note of modNotes.filter(note => note.userNote?.note)) {
            prompt += `* ${format(note.createdAt, "yyyy-MM-dd")}: ${note.userNote?.note}\n`;
            prompt += `${blockquoteText(note.userNote?.note ?? "")}\n\n`;
        }
    }

    prompt += "\n\n## JSON containing information about the user and their history:\n\n";
    prompt += JSON.stringify(userHistory, null, 2);

    const openAI = new OpenAI({ apiKey: apiKeyInformation.apiKey });
    const appSettings = await settings.getAll();
    const response = await openAI.responses.create({
        model: appSettings[AppSetting.OpenAIModel] as string || "gpt-5.4-mini",
        input: prompt,
    });

    console.log(`Tokens used: ${response.usage?.total_tokens}`);

    await reddit.modMail.reply({
        conversationId: modmailMessage.conversationId,
        body: `${response.output_text}\n\n*This response is AI generated, and may not be 100% accurate. Use your judgment as a moderator to make the final decision on the appeal.*`,
        isInternal: true,
    });

    return { message: "appeal handling not yet implemented" };
}
