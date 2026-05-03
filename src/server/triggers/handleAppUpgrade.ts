import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { context, scheduler } from "@devvit/web/server";
import { SchedulerJob } from "../scheduler";
import { addSeconds } from "date-fns";

export const handleAppUpgrade = async (c: Context) => {
    console.log(`App upgraded in subreddit ${context.subredditName} to version ${context.appVersion}`);

    await scheduler.runJob({
        name: SchedulerJob.PopulateInitialBanDates,
        runAt: addSeconds(new Date(), 10),
    });

    return c.json<TriggerResponse>({ message: "app upgrade handled" }, 200);
};
