export enum SchedulerJob {
    CleanupDeletedAccounts = "cleanupDeletedAccounts",
    PopulateInitialBanDates = "populateInitialBanDates",
    CallOpenAI = "callOpenAI",
    SendModmailAsync = "sendModmailAsync",
}
