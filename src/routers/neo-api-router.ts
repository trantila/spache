import * as express from "express";
import { Request, Response } from "express";
import { getDatabaseConnection } from "../database";
import { NeoApi } from "../neo-api";
import { logError } from "../utils";
import { CloseApproachService } from "../close-approach-service";
import { addDays } from "date-fns";
import { URL } from "url";


function getRawParam(query: object, paramName: string): string | null {
    const raw: string | undefined = query[paramName];
    return raw === undefined ? null : raw;
}

function getDateParam(query: object, paramName: string): Date | null {
    const raw = getRawParam(query, paramName);
    return raw ? new Date(raw) : null;
}


export function neoApiRouter(origin: URL, nasaApiKey: string) {
    const router = express.Router();

    router.get("/feed", async (req: Request, res: Response) => {
        const from_ = getDateParam(req.query, "start_date");
    
        if (!from_) {
            res.status(400).send("Required parameter `start_date` not provided.");
        }
    
        const from = from_ as Date;
        const to = getDateParam(req.query, "end_date") || addDays(from, 7);
    
        try {
            const neoApi = new NeoApi(nasaApiKey);
            const dbConnection = await getDatabaseConnection();
            const closeApproachService = new CloseApproachService(origin, neoApi, dbConnection);
    
            const feedResult = await closeApproachService.queryByDateRange(from, to);
            res.send(feedResult);
        } catch (err) {
            const errString = err.toString();
            logError(errString);
            console.error(`[${new Date().toISOString()}] ${errString}`);
            res.status(500).send(errString);
        }
    });

    return router;
}
