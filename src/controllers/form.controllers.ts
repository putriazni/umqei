import { Request, Response } from 'express';
import { RowDataPacket } from "mysql2";
import { PeriodService } from "../services/periodService";
import { UserService } from "../services/userService";
import { FormService } from "../services/formService";
import { AccessLayer } from "../constants/global";
import { logHelper } from "../middleware/logger";

export async function getSelfAuditForms(req: Request, res: Response) {
    let ptjAcademic = req.params.ptjAcademic;
    const groupId = req.params.groupId;
    const respectiveGroupId = req.params.respectiveGroupId;
    const yearSession = decodeURIComponent(req.params.yearSession);
    const mode = req.params.mode;

    if (isNaN(+groupId) || isNaN(+respectiveGroupId)) {
        return res.json(null);
    }

    const groupInfo = await UserService.getUserGroup(+groupId);
    const respectiveGroupInfo = await UserService.getUserGroup(+respectiveGroupId);
    const timeline = await PeriodService.getSession(yearSession);
    if (!timeline) {
        return res.json(null);
    }


    if (groupInfo) {
        const currentDate = new Date();
        if (mode === "0" && (currentDate < new Date(timeline.selfAuditStartDate) || currentDate > new Date(timeline.auditEndDate))) {
            return res.json(null);
        }
        if (mode === "1" && (currentDate < new Date(timeline.auditStartDate) || currentDate > new Date(timeline.auditEndDate))) {
            return res.json(null);
        }
    }

    if (respectiveGroupInfo) {
        if (groupId !== respectiveGroupId)
            respectiveGroupInfo.ptjAcademic ? ptjAcademic = 'true' : ptjAcademic = 'false';
    }

    try {
        const [result] = await FormService.formQuery(+respectiveGroupId, +respectiveGroupId, timeline.selfAuditStartDate, timeline.selfAuditEndDate, ptjAcademic, yearSession) as RowDataPacket[];
        const toReturn = {
            forms: [{}],
            ptjResponse: [{}],
            auditorResponse: [{}]
        };

        for (let i = 0; i < result.length; i++) {
            const {
                formID,
                title,
                formDefinition,
                formType,
                formNumber,
                formUpdatedDate,
                formStatus,
                minScale,
                maxScale,
                weightage,
                flag,
                formResponseID,
                groupID,
                respectiveGroupID,
                submitted,
                inSession
            } = result[i];

            toReturn.forms.push({
                formID: formID,
                title: title,
                formDefinition: formDefinition,
                formType: formType,
                formNumber: formNumber,
                formUpdatedDate: formUpdatedDate,
                formStatus: formStatus,
                minScale: minScale,
                maxScale: maxScale,
                weightage: weightage,
                flag: flag,
            });

            toReturn.ptjResponse.push(formResponseID ? {
                formResponseID: formResponseID,
                formID: formID,
                groupID: groupID,
                respectiveGroupID: respectiveGroupID,
                submitted: submitted,
                inSession: inSession
            } : {});
            if (!i) {
                toReturn.forms.shift();
                toReturn.ptjResponse.shift();
            }
        }

        if (groupId !== respectiveGroupId) {
            const [auditorResult] = await FormService.formQuery(+groupId, +respectiveGroupId, timeline.auditStartDate, timeline.auditEndDate, ptjAcademic, yearSession) as RowDataPacket[];
            for (let i = 0; i < result.length; i++) {
                const {
                    formID,
                    formResponseID,
                    groupID,
                    respectiveGroupID,
                    submitted,
                    inSession
                } = auditorResult[i];

                toReturn.auditorResponse.push(formResponseID ? {
                    formResponseID: formResponseID,
                    formID: formID,
                    groupID: groupID,
                    respectiveGroupID: respectiveGroupID,
                    submitted: submitted,
                    inSession: inSession
                } : {});
                if (!i) {
                    toReturn.auditorResponse.shift();
                }
            }
        }

        logHelper(`GET ${req.originalUrl}`, 'getForms', AccessLayer.Controllers);
        res.json(toReturn);
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json(
            {
                message: 'Error fetching forms'
            }
        );
        logHelper(`GET ${req.originalUrl}`, 'getForms', AccessLayer.Controllers, error);
    }
}