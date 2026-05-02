import { redis } from "@devvit/web/server";
import { addUserToCleanupLog, removeUserFromCleanupLog } from "./cleanup";

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
