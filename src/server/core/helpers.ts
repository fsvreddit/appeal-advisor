import { context, reddit } from "@devvit/web/server";

export async function isUserBanned (username: string): Promise<boolean> {
    const bannedUsers = await reddit.getBannedUsers({
        subredditName: context.subredditName,
        username,
    }).all();

    return bannedUsers.length > 0;
}
