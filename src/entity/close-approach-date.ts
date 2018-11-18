import {
    Entity,
    PrimaryColumn,
    OneToMany,
} from "typeorm";
import { CloseApproach } from "./close-approach";


@Entity()
export class CloseApproachDate {
    @PrimaryColumn()
    day: number;

    @OneToMany(_ => CloseApproach, ca => ca.date, {
        cascade: true,
    })
    closeApproaches: CloseApproach[];
}
