import { Between, In, EntityManager } from "typeorm";
import { NeoApiObject } from "./neo-api";
import { getFullDaysSinceEpoch } from "./utils";
import { CloseApproachDate } from "./entity/close-approach-date";
import { CloseApproach } from "./entity/close-approach";


export interface NeosByDay {
    [day: number]: NeoApiObject[];
}

export class NeosByDayRepository {
    entityManager: EntityManager;

    constructor(entityManager: EntityManager) {
        this.entityManager = entityManager;
    }

    /**
     * Get cached close-approaches on date range or null if refresh is needed.
     * Any missing day will cause a full refresh.
     * @param from date
     * @param to date, inclusive
     */
    async queryByDateRange(from: Date, to: Date): Promise<NeosByDay | null> {
        const fromDay = getFullDaysSinceEpoch(from);
        const toDay = getFullDaysSinceEpoch(to);

        const closeApproachDateRepo = this.entityManager.getRepository(CloseApproachDate);
        const dates = await closeApproachDateRepo.find({
            relations: ["closeApproaches"],
            where: { day: Between(fromDay, toDay) },
            order: { day: "ASC" },
        });

        // End-inclusive it is, as weird as it feels.
        // TODO Less aggressive cache-bypassing needed!
        const nexpected = toDay - fromDay + 1;
        if (dates.length < nexpected)
            return null;

        return dates.reduce((neosByDay, date) => {
            return Object.assign(neosByDay, {
                [date.day]: date.closeApproaches.map(approach => approach.nearEarthObject)
            });
        }, {} as NeosByDay);
    }

    /**
     * Update the cache with given days' close approaches.
     * @param data of days to update
     */
    async update(data: NeosByDay): Promise<void> {
        const closeApproachDates: CloseApproachDate[] = [];
        for (const day in data) {
            const closeApproachDate: CloseApproachDate = {
                day: day as unknown as number,
                closeApproaches: [],
            };

            closeApproachDate.closeApproaches = data[day].map(neo => {
                // TODO Picking first unconditionally seems like a bad idea!
                const approachData = neo.close_approach_data[0];
                // TODO Seems like a silly way to go around not setting the id...
                return Object.assign(new CloseApproach(), {
                    date: closeApproachDate,
                    closestDistanceAu: Number.parseFloat(approachData.miss_distance.astronomical),
                    orbitingBody: approachData.orbiting_body,
                    relativeVelocityKmps: Number.parseFloat(approachData.relative_velocity.kilometers_per_second),
                    nearEarthObject: neo,
                });
            });
            
            closeApproachDates.push(closeApproachDate);
        }

        const days = closeApproachDates.map(date => date.day);

        // Delete all overlapping data in the crudest possible way before saving the new.
        // `repo.save` alone won't do presumably because typeorm cannot know that entities
        // with given ids exist in the db in this "free" case.
        await this.entityManager.delete(CloseApproachDate, { day: In(days) });
        await this.entityManager.save(CloseApproachDate, closeApproachDates);
    }
}
