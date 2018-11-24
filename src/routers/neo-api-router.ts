import * as express from "express";
import { Request, Response } from "express";
import { getDatabaseConnection } from "../database";
import { NeoApi } from "../neo-api";
import { logError, getDateParam, addUTCDays } from "../utils";
import { CloseApproachService } from "../services/close-approach-service";
import { URL } from "url";


export function neoApiRouter(origin: URL, nasaApiKey: string) {
    const router = express.Router();

    router.get("/feed", async (req: Request, res: Response) => {
        const from_ = getDateParam(req.query, "start_date");
    
        if (!from_) {
            res.status(400).send("Required parameter `start_date` not provided.");
        }
    
        const from = from_ as Date;
        const to = getDateParam(req.query, "end_date") || addUTCDays(from, 7);
    
        try {
            const neoApi = new NeoApi(nasaApiKey);
            const dbConnection = await getDatabaseConnection();
            const closeApproachService = new CloseApproachService(origin, neoApi, dbConnection);
    
            const feedResult = await closeApproachService.queryByDateRange(from, to);
            res.send(feedResult);
        } catch (err) {
            const errString = err.toString();
            logError(errString);
            res.status(500).send(errString);
        }
    });

    return router;
}
