import * as express from "express";
import { Request, Response } from "express";
import { addDays } from "date-fns";
import { NeoApi } from "./neo-api";
import { logError } from "./utils";
import { CloseApproachService } from "./close-approach-service";
import { URL } from "url";


const hostname = "localhost";
const port = 3000;
const host = `${hostname}:${port}`;
// TODO HTTPS would rock :)
const origin = new URL(`http://${host}`);
const nasaApiKey = process.env["SPACHE_NASA_API_KEY"] || "DEMO_KEY";


function getRawParam(query: object, paramName: string): string | null {
    const raw: string | undefined = query[paramName];
    return raw === undefined ? null : raw;
}

function getDateParam(query: object, paramName: string): Date | null {
    const raw = getRawParam(query, paramName);
    return raw ? new Date(raw) : null;
}


const app = express();

app.get("/", function(req: Request, res: Response) {
    res.send("Hello, world!");
});

app.get("/neo/rest/v1/feed", async (req: Request, res: Response) => {
    const from_ = getDateParam(req.query, "start_date");

    if (!from_) {
        res.status(400).send("Required parameter `start_date` not provided.");
    }

    const from = from_ as Date;
    const to = getDateParam(req.query, "end_date") || addDays(from, 7);

    const neoApi = new NeoApi(nasaApiKey);
    const closeApproachService = new CloseApproachService(origin, neoApi);

    try {
        const feedResult = await closeApproachService.queryByDateRange(from, to);
        res.send(feedResult);
    } catch (err) {
        const errString = err.toString();
        logError(errString);
        console.error(`[${new Date().toISOString()}] ${errString}`);
        res.status(500).send(errString);
    }
});

app.listen(port, hostname, () => {
    console.log(`Listening at ${host}`);
    console.log(`Using NASA API KEY "${nasaApiKey}"`);
});
