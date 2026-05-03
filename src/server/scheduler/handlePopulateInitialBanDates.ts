import { Context } from "hono";
import { populateInitialBanDates } from "../core";

export const handlePopulateInitialBanDates = async (c: Context) => {
    await populateInitialBanDates();
    return c.json({ message: "populate initial ban dates complete" }, 200);
};
