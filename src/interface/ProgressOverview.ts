import { RowDataPacket } from "mysql2";

export interface Progress extends RowDataPacket {
    groupID: number,
    groupName: string,
    selfAuditStat: number,
    auditStat: number,
    lastUpdatedDate: string
}