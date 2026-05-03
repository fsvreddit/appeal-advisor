import { context, reddit, redis } from "@devvit/web/server";
import { addBulkUsersToCleanupLog, addUserToCleanupLog, removeUserFromCleanupLog } from "./cleanup";

const BAN_KEY = "userBanDates";

export async function recordBan (username: string) {
    await redis.zAdd(BAN_KEY, { member: username, score: Date.now() });
    await addUserToCleanupLog(username);
}

export async function removeRecordOfBan (username: string) {
    await redis.zRem(BAN_KEY, [username]);
    await removeUserFromCleanupLog(username);
}

export async function getBanDate (username: string): Promise<Date | undefined> {
    const score = await redis.zScore(BAN_KEY, username);
    return score ? new Date(score) : undefined;
}

export async function populateInitialBanDates () {
    const completedKey = "initialBanDatesPopulated";
    if (await redis.exists(completedKey)) {
        console.log("Initial ban dates have already been populated. Skipping.");
        return;
    }

    const recentBanEvents = await reddit.getModerationLog({
        subredditName: context.subredditName,
        type: "banuser",
        limit: 1000,
    }).all();

    const userBanDates: Record<string, Date> = {};

    for (const event of recentBanEvents) {
        if (!event.target?.author) {
            continue;
        }

        const currentlyRecordedDate = userBanDates[event.target.author];
        if (!currentlyRecordedDate) {
            userBanDates[event.target.author] = event.createdAt;
        } else {
            if (event.createdAt > currentlyRecordedDate) {
                userBanDates[event.target.author] = event.createdAt;
            }
        }
    }

    await addBulkUsersToCleanupLog(Object.keys(userBanDates));
    await redis.zAdd(BAN_KEY, ...Object.entries(userBanDates).map(([username, date]) => ({
        member: username,
        score: date.getTime(),
    })));

    console.log(`Populated initial ban dates for ${Object.keys(userBanDates).length} users.`);

    await redis.set(completedKey, "true");
}
