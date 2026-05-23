import { UiResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { getAPIKey } from "../core";

export const setAPIKeyMenu = async (c: Context) => {
    const apiKey = await getAPIKey();

    let helpText: string | undefined;
    if (apiKey.type === "local") {
        helpText = "A local API key is currently set. Enter a new key to replace it, or enter 'delete' to remove it.";
    }

    return c.json<UiResponse>({
        showForm: {
            name: "set-openai-key",
            form: {
                fields: [
                    {
                        name: "apiKey",
                        label: "OpenAI API Key",
                        helpText,
                        type: "string",
                        required: false,
                    },
                ],
            },
        },
    });
};
