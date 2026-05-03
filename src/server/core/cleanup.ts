import { context, reddit, redis, scheduler, User } from "@devvit/web/server";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { SchedulerJob } from "../scheduler";
import { getBanDate, removeRecordOfBan } from "./banRecording";
import { isUserBanned } from "./helpers";
import pluralize from "pluralize";

const CLEANUP_LOG_KEY = "cleanupLog";
const DAYS_BETWEEN_CLEANUP = 28;

export async function removeUserFromCleanupLog (username: string) {
    await redis.zRem(CLEANUP_LOG_KEY, [username]);
}

export async function addUserToCleanupLog (username: string) {
    await redis.zAdd(CLEANUP_LOG_KEY, { member: username, score: addDays(new Date(), DAYS_BETWEEN_CLEANUP).getTime() });
}

export async function addBulkUsersToCleanupLog (usernames: string[]) {
    if (usernames.length === 0) {
        return;
    }

    // Add users to cleanup log with a random score within the next 28 days to help distribute cleanup workload
    const entries = usernames.map(username => ({
        member: username,
        score: addSeconds(new Date(), Math.floor(Math.random() * DAYS_BETWEEN_CLEANUP * 24 * 60 * 60)).getTime(),
    }));

    await redis.zAdd(CLEANUP_LOG_KEY, ...entries);
}

async function removeRecordsForUser (username: string) {
    await removeRecordOfBan(username);
    await removeUserFromCleanupLog(username);
}

async function checkAndCleanupUser (username: string) {
    if (!await getBanDate(username)) {
        await removeUserFromCleanupLog(username);
        console.log(`Cleanup: User ${username} has no recorded ban date, removed from cleanup log.`);
        return;
    }

    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(username);
    } catch {
        //
    }

    if (!user) {
        // Check to see if we can retrieve usernotes. If we can, user is not deleted (likely shadowbanned/suspended).
        try {
            await reddit.getModNotes({
                subreddit: context.subredditName,
                user: username,
            }).all();
        } catch {
            await removeRecordsForUser(username);
            console.log(`Cleanup: User ${username} appears to be deleted, removed from cleanup log and ban records.`);
            return;
        }
    }

    // Check to see if the user is still banned.
    const userIsBanned = await isUserBanned(username);
    if (!userIsBanned) {
        await removeRecordsForUser(username);
        console.log(`Cleanup: User ${username} is no longer banned, removed from cleanup log and ban records.`);
        return;
    }

    await addUserToCleanupLog(username);
}

export async function cleanupDeletedAccounts (firstRun: boolean) {
    const runRecentlyKey = "cleanupRecentlyRun";
    if (firstRun) {
        if (await redis.exists(runRecentlyKey)) {
            console.log("Cleanup: Cleanup has run recently, skipping this scheduled run");
            return;
        }

        console.log("Cleanup: Running cleanup of deleted and unbanned accounts");
    }

    await redis.set(runRecentlyKey, Date.now().toString(), { expiration: addMinutes(new Date(), 1) });

    const runLimit = addSeconds(new Date(), 15);
    const usersToCleanup = await redis.zRange(CLEANUP_LOG_KEY, 0, Date.now(), { by: "score" });

    let processed = 0;

    while (usersToCleanup.length > 0 && new Date() < runLimit) {
        const firstEntry = usersToCleanup.shift();
        if (!firstEntry) {
            break;
        }

        await checkAndCleanupUser(firstEntry.member);
        processed++;
    }

    if (usersToCleanup.length > 0) {
        await scheduler.runJob({
            name: SchedulerJob.CleanupDeletedAccounts,
            runAt: new Date(),
        });
    } else {
        await redis.del(runRecentlyKey);
    }

    console.log(`Cleanup: Processed ${processed} ${pluralize("user", processed)}. ${usersToCleanup.length} ${pluralize("user", usersToCleanup.length)} remain due a check at this time.`);
}
