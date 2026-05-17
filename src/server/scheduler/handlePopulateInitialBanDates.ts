import { Context } from "hono";
import { populateInitialBanDates } from "../core";
import { TaskResponse } from "@devvit/web/server";

export const handlePopulateInitialBanDates = async (c: Context) => {
    await populateInitialBanDates();
    return c.json<TaskResponse>({ message: "populate initial ban dates complete" }, 200);
};
