Appeal Advisor is a Dev Platform app that analyzes user ban appeals to save moderator time and help them spot changes that they may have made to their behavior since.

The app considers:

* The user's most recent 100 posts and comments
* The reason the user was banned
* Any mod notes about the user
* The subreddit's rule set

And runs it through AI to see if the user understands the reason for the ban, is apologetic and open to change, and if recent history supports this. For example if a user was banned for incivility but their behavior across Reddit since is full of abusive comments, it is likely that the app will recommend denial. But if they have cleaned up their act since, it will be more supportive of unbanning.

You can summon this app using a username mention in modmail (u/appeal-advisor) in a private moderator note. The app will remind you that this is possible if a banned user writes in.

The app does not perform unban actions itself, just advises moderators using private moderator notes.

All subreddits get ten free ban appeals per calendar month funded by the developer. If you need more than this, you will need to provide your own OpenAI API key, which you can do through the subreddit's three-dot menu.

## Source code

Appeal Advisor is open source under the BSD three-clause license. [You can find the source code on Github](https://github.com/fsvreddit/appeal-advisor).

## Fetch Domains

* api.openai.com: This app uses the OpenAI API to handle appeals.
