Appeal Advisor is a Dev Platform app that analyzes user ban appeals to save moderator time and help them spot changes that they may have made to their behavior since.

The app considers:

* The user's most recent 100 posts and comments
* The reason the user was banned
* Any mod notes about the user
* The subreddit's rule set

And runs it through AI to see if the user understands the reason for the ban, is apologetic and open to change, and if recent history supports this. For example if a user was banned for incivility but their behavior across Reddit since is full of abusive comments, it is likely that the app will recommend denial. But if they have cleaned up their act since, it will be more supportive of unbanning.

You can either choose to summon this app using a username mention in modmail (u/appeal-advisor) or configure it to always respond to new threads from a banned user. I recommend using username mentions only because many users "appeals" consist of abuse directed at subreddit moderators, and you don't need AI to tell you that.

Yes, this is going to be a hackathon entry for any Admins reviewing privately published apps!

## Source code

Appeal Advisor is open source under the BSD three-clause license. [You can find the source code on Github](https://github.com/fsvreddit/modmailtranslate) (this repo will be made public once the app is).

## Fetch Domains

* api.openai.com: This app uses the OpenAI API to handle appeals.
