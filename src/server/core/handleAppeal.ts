import { context, Post, reddit, scheduler, settings, SettingsValues } from "@devvit/web/server";
import { isT3, TriggerResponse } from "@devvit/web/shared";
import { format } from "date-fns";
import _ from "lodash";
import { AppSetting, CallOpenAIData, getAPIKey, getBanDate, incrementAppealsThisMonth, ModmailMessage } from ".";
import OpenAI from "openai";
import { SchedulerJob } from "../scheduler";

const basePrompt = `
You are a helpful assistant for subreddit moderators that provides advice on whether a ban appeal should be approved or denied.

You will be provided with:

* The content of the user's appeal message
* The rules of the subreddit (if available)
* Moderator notes about the user (if available)
* Explanations of subreddit-specific terminology (if available)
* The user's recent Reddit history (if available)

Your task is to advise moderators on whether the appeal should be approved, denied, or if there is not enough information to make a reliable judgment.

When evaluating the appeal, consider:

* Whether the user takes responsibility for their actions
* Whether they demonstrate understanding of the violated rules
* Whether their tone is respectful and constructive
* Whether their recent behavior indicates improvement
* Whether their broader Reddit activity aligns with Reddit policies and subreddit rules

Give substantial weight to recent behavior, especially activity after the ban date if known. Demonstrated positive engagement after a ban is a strong signal in favor of approval, even if earlier history included rule violations.

Also consider the severity, frequency, and recency of past violations. Repeated harmful behavior, harassment, ban evasion, or continued rule-breaking after the ban are strong signals against approval.

Focus primarily on observable behavior and evidence rather than emotional language alone. Do not speculate about motivations, intent, or personal characteristics beyond the provided information.

Missing information should not be treated as evidence either for or against the appeal.

If the available evidence is mixed or contradictory, acknowledge the uncertainty explicitly in the recommendation and reasoning.

Consider the overall trajectory of the user's behavior rather than treating isolated minor violations as determinative.

Maintain a neutral, professional tone.

Provide your advice in the following format:

* A recommendation (single line) of either "Approve", "Deny" or "Not enough information", and a confidence indicator (e.g. words such as "high confidence", "medium confidence", "low confidence").
* Key factors: three to six bullet points with short sentences summarizing the most important factors that led to your recommendation.
* Reasoning: Provide concise reasoning in 2–4 paragraphs that explains the recommendation in more detail, referencing specific information from the appeal message, subreddit rules, moderator notes, and user history as necessary.

Confidence should reflect the quality and consistency of the evidence:

* High confidence: strong, consistent evidence supporting the recommendation
* Medium confidence: mixed or incomplete evidence
* Low confidence: limited, ambiguous, or conflicting evidence

For the key factors bullet points:

* Be concise and factual rather than speculative
* Focus on the strongest signals either for or against approval

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

function getSubredditTerminology (appSettings: SettingsValues): Record<string, string> {
    const subTerminologyValue = appSettings[AppSetting.SubredditTerminology] as string | undefined;
    if (!subTerminologyValue) {
        return {};
    }

    const lines = subTerminologyValue.split("\n");
    const terminology: Record<string, string> = {};
    for (const line of lines) {
        const [term, meaning] = line.split(":").map(part => part.trim());
        if (term && meaning) {
            terminology[term] = meaning;
        }
    }
    return terminology;
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

    const appSettings = await settings.getAll();

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

    const subredditTerminology = getSubredditTerminology(appSettings);
    if (Object.keys(subredditTerminology).length > 0) {
        prompt += "\n\n## Subreddit-specific terminology:\n\n";
        for (const [term, meaning] of Object.entries(subredditTerminology)) {
            prompt += `* **${term}**: ${meaning}\n`;
        }
    }

    prompt += "\n\n## JSON containing information about the user and their history:\n\n";
    prompt += JSON.stringify(userHistory, null, 2);

    const data: CallOpenAIData = {
        prompt,
        conversationId: modmailMessage.conversationId,
    };

    // Actually do OpenAI call in a scheduled job to avoid hitting execution time limits for the trigger
    await scheduler.runJob({
        name: SchedulerJob.CallOpenAI,
        data,
        runAt: new Date(),
    });

    return { message: "scheduled OpenAI call" };
}

export async function callOpenAIAndRespond (prompt: string, conversationId: string) {
    const apiKeyInformation = await getAPIKey();

    if (!apiKeyInformation.apiKey) {
        await reddit.modMail.reply({
            conversationId,
            body: `Sorry, but I am currently unable to analyze this appeal because there is no API key available and you are out of free appeals for this month.`,
            isInternal: true,
        });
        console.error("No API key available to handle appeal");
        return;
    }

    const openAI = new OpenAI({ apiKey: apiKeyInformation.apiKey });
    const appSettings = await settings.getAll();
    const response = await openAI.responses.create({
        model: appSettings[AppSetting.OpenAIModel] as string || "gpt-5.4-mini",
        input: prompt,
        temperature: 0.2,
    });

    console.log(`Tokens used: ${response.usage?.total_tokens}`);

    await reddit.modMail.reply({
        conversationId,
        body: `${response.output_text}\n\n*This response is AI generated, and may not be 100% accurate. Use your judgment as a moderator to make the final decision on the appeal.*`,
        isInternal: true,
    });

    if (apiKeyInformation.type === "global") {
        await incrementAppealsThisMonth();
    }
}
