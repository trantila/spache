import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
} from "typeorm";
import { CloseApproachDate } from "./close-approach-date";
import { NeoApiObject } from "../neo-api";


@Entity()
export class CloseApproach {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(_ => CloseApproachDate, d => d.closeApproaches, {
        onDelete: "CASCADE",
    })
    date: CloseApproachDate;

    // Relative velocity in km/s
    @Column("float")
    relativeVelocityKmps: number;

    // Closest distance in AUs
    @Column("float")
    closestDistanceAu: number;

    @Column()
    orbitingBody: string;

    @Column("simple-json")
    nearEarthObject: NeoApiObject
}
