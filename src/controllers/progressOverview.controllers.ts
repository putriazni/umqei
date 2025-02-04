import * as mysql from "../db";
import { Request, Response } from 'express';
import { RowDataPacket } from "mysql2";
import { ProgressOverviewService } from "../services/progressOverviewService";
import { AccessLayer } from "../constants/global";
import { logHelper } from "../middleware/logger";
import { UserService } from "../services/userService";
import { AuditorPtjComments } from "../interface/User";

export async function getProgress(req: Request, res: Response) {
    const groupId = req.params.groupId;
    const userId = req.params.userId;
    const role = req.params.role;
    const year = req.params.year;

    try {
        const [result] = await ProgressOverviewService.progressQuery(groupId, userId, role, year) as RowDataPacket[];
        const toReturn = [];
        for (let i = 0; i < result.length; i++) {
            const {
                groupID,
                groupName,
                responseCount,
                submittedCount,
                lastUpdatedDate,
                auditResponseCount,
                auditSubmittedCount,
                respectiveAuditors,
                year
            } = result[i];
            const groupInfo = await UserService.getUserGroup(+groupID);
            const formCount = await ProgressOverviewService.getFormCount(groupInfo!.ptjAcademic ? "true" : "false");
            for (let j = 0; j < formCount.length; j++) {
                const {
                    yearSession,
                } = formCount[j];

                let selfAuditStatus;

                if (result[i].yearSession === formCount[j].yearSession) {
                    const assignedAuditor = await UserService.getAuditorUserID(+groupID, result[i].yearSession);
                    const auditorComments = Array.isArray(assignedAuditor)
                        ? assignedAuditor.map(item => ({ commented: item.comment }))
                        : [];
                    const doneCommenttedAll = auditorComments.every(auditorComments => auditorComments.commented !== null && auditorComments.commented.length > 0)
                    if (responseCount > 0) {
                        if (responseCount == submittedCount && submittedCount == formCount[j].active_form_count) {
                            selfAuditStatus = 2;
                        } else {
                            selfAuditStatus = 1;
                        }
                    } else {
                        selfAuditStatus = 0;
                    }

                    let auditStatus;

                    if (auditResponseCount > 0) {
                        if (auditResponseCount == auditSubmittedCount && auditSubmittedCount == formCount[j].active_form_count && doneCommenttedAll) {
                            auditStatus = 2;
                        } else {
                            auditStatus = 1;
                        }
                    } else {
                        auditStatus = 0;
                    }

                    toReturn.push({
                        groupID,
                        groupName,
                        yearSession,
                        year,
                        selfAuditStat: selfAuditStatus,
                        lastUpdatedDate,
                        auditStat: auditStatus,
                        doneCommenttedAll
                    });
                }
            }
        }
        logHelper(`GET ${req.originalUrl}`, 'getProgress', AccessLayer.Controllers);
        res.json(toReturn);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json(
            {
                message: 'Error fetching progress'
            }
        );
        logHelper(`GET ${req.originalUrl}`, 'getProgress', AccessLayer.Controllers, error, true);
    }
}