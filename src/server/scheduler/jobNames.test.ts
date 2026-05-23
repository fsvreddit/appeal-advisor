import assert from "node:assert/strict";
import { describe, it } from "vitest";
import devvitConfig from "../../../devvit.json";
import { SchedulerJob } from "./jobNames.js";

const configSchedulerTaskKeys: string[] = Object.keys(devvitConfig.scheduler.tasks).sort();

const schedulerJobValues: string[] = Object.values(SchedulerJob).sort();

describe("Scheduler job configuration parity", () => {
    it("has a devvit.json scheduler task for every SchedulerJob enum value", () => {
        const missingFromConfig = schedulerJobValues.filter(jobName => !configSchedulerTaskKeys.includes(jobName));

        assert.deepEqual(missingFromConfig, []);
    });

    it("has a SchedulerJob enum value for every devvit.json scheduler task", () => {
        const missingFromEnum = configSchedulerTaskKeys.filter(jobName => !schedulerJobValues.includes(jobName));

        assert.deepEqual(missingFromEnum, []);
    });
});
