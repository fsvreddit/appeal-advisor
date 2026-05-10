import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";

export const validateSubredditTerminology = async (c: Context) => {
    const request = c.req.json<SettingsValidationRequest<string>>();

    const { value } = await request;
    if (!value) {
        return c.json<SettingsValidationResponse>({ success: true }, 200);
    }

    const lines = value.split("\n");
    const termsFound = new Set<string>();

    for (const line of lines) {
        const [term, meaning] = line.split(":").map(part => part.trim());
        if (!term || !meaning) {
            return c.json<SettingsValidationResponse>({ success: false, error: `Invalid format in line: "${line}". Each line must be in the format "term: meaning".` });
        }

        if (termsFound.has(term)) {
            return c.json<SettingsValidationResponse>({ success: false, error: `Duplicate term found: "${term}". Each term must be unique.` });
        }

        termsFound.add(term);
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
