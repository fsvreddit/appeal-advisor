export enum AppSetting {
    // Sub-scoped settings
    HandleAppealsAutomatically = "handleAppealsAutomatically",
    DetailLevel = "detailLevel",
    SubredditTerminology = "subredditTerminology",

    // App-scoped settings
    GlobalAPIKey = "openAPIKey",
    FreeAppealsPerMonth = "freeAppealsPerMonth",
    OpenAIModel = "openAIModel",
}

export enum DetailLevel {
    Concise = "concise",
    Detailed = "detailed",
}
