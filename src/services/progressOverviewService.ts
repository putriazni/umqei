import { AccessLayer } from "../constants/global";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { logHelper } from "../middleware/logger";

export const ProgressOverviewService = {
    async getFormCount(ptjAcademic: string) {
        try {
            let query = `
            SELECT 
                yearSession, 
                COUNT(*) AS active_form_count
                FROM (
                    SELECT DISTINCT
			            fps.yearSession,
			            f.formType,
			            fps.formID AS formToBeFilled
			            FROM form_period_set fps
			        INNER JOIN 
			            form f ON f.formID = fps.formID`;
            if (ptjAcademic !== 'true') {
                query += `
                            AND (
                                f.formType <> 1
                                OR f.flag <> 1
                            )`;
            }
            query += `) AS subquery GROUP BY yearSession;`;
            const [rows] = await mysql.query(query) as RowDataPacket[];
            logHelper('Get active form count', 'getFormCount', AccessLayer.Controllers);
            return rows;
        } catch (error) {
            logHelper('Get active form count', 'getFormCount', AccessLayer.Controllers, error, true);
            throw error;
        }
    },

    async progressQuery(
        groupId: string,
        userId: string,
        role: string,
        year: string
    ) {
        try {
            const isAdmin = role === 'Admin';
            const isAuditor = role === 'Auditor';
            const isYearSession = year.includes(' ')

            const query = `
            SELECT
                ug.groupID,
                ug.groupName,
                p.yearSession,
                p.year,
                COALESCE(responseCounts.responseCount, 0) AS responseCount,
                COALESCE(submittedCounts.submittedCount, 0) AS submittedCount,
                COALESCE(MAX(fr.lastUpdatedDate)) AS lastUpdatedDate,
                COALESCE(auditResponseCounts.auditResponseCount, 0) AS auditResponseCount,
                COALESCE(auditSubmittedCounts.auditSubmittedCount, 0) AS auditSubmittedCount,
                apc.respectiveAuditors
            FROM usergroup ug
            CROSS JOIN period p
            LEFT JOIN form_response AS fr ON ug.groupID = fr.groupID
                AND fr.createdDate >= p.selfAuditStartDate
                AND fr.createdDate <= p.selfAuditEndDate
            LEFT JOIN (
                SELECT
                    fr.groupID,
                    p.yearSession,
                    COUNT(*) AS responseCount
                FROM form_response AS fr
                JOIN period p ON
                    fr.createdDate >= p.selfAuditStartDate
                    AND fr.createdDate <= p.selfAuditEndDate
                GROUP BY fr.groupID, p.yearSession
            ) AS responseCounts ON ug.groupID = responseCounts.groupID 
                AND p.yearSession = responseCounts.yearSession
            LEFT JOIN (
                SELECT
                    fr2.groupID,
                    p.yearSession,
                    COUNT(*) AS submittedCount
                FROM form_response AS fr2
                JOIN period p ON
                    fr2.createdDate >= p.selfAuditStartDate
                    AND fr2.createdDate <= p.selfAuditEndDate
                WHERE fr2.submitted = '1'
                GROUP BY fr2.groupID, p.yearSession
            ) AS submittedCounts ON ug.groupID = submittedCounts.groupID 
                AND p.yearSession = submittedCounts.yearSession
            LEFT JOIN (
                SELECT
                    fr3.respectiveGroupID,
                    p.yearSession,
                    COUNT(*) AS auditResponseCount
                FROM usergroup AS ug2
                JOIN form_response AS fr3 ON ug2.groupID = fr3.groupID
                JOIN period p ON
                    fr3.createdDate >= p.auditStartDate
                    AND fr3.createdDate <= p.auditEndDate
                WHERE ug2.role = 'Auditor'
                GROUP BY fr3.respectiveGroupID, p.yearSession
            ) AS auditResponseCounts ON ug.groupID = auditResponseCounts.respectiveGroupID 
                AND p.yearSession = auditResponseCounts.yearSession
            LEFT JOIN (
                SELECT
                    fr4.respectiveGroupID,
                    p.yearSession,
                    SUM(fr4.submitted = '1') AS auditSubmittedCount
                FROM usergroup AS ug3
                JOIN form_response AS fr4 ON ug3.groupID = fr4.groupID
                JOIN period p ON
                    fr4.createdDate >= p.auditStartDate
                    AND fr4.createdDate <= p.auditEndDate
                WHERE ug3.role = 'Auditor'
                GROUP BY fr4.respectiveGroupID, p.yearSession
            ) AS auditSubmittedCounts ON ug.groupID = auditSubmittedCounts.respectiveGroupID 
                AND p.yearSession = auditSubmittedCounts.yearSession
            LEFT JOIN (
                SELECT
                    ${isAuditor ? 'aptc.auditorUserID,' : ''}
                    aptc.ptjGroupID,
                    aptc.yearSession,
                    json_objectagg(aptc.auditorUserID, aptc.comment) as respectiveAuditors
                FROM auditor_ptj_comments aptc
                GROUP BY aptc.ptjGroupID, aptc.yearSession ${isAuditor ? ', aptc.auditorUserID' : ''}
            ) AS apc ON ug.groupID = apc.ptjGroupID AND p.yearSession = apc.yearSession
        
            WHERE ug.role NOT IN ('Auditor', 'Admin')
                ${isYearSession ? `AND p.yearSession = ?` : `AND p.year <= ?`}
                AND p.selfAuditStartDate <= CURRENT_TIMESTAMP
                ${isAdmin ? '' : `AND ${isAuditor ? 'apc.auditorUserID = ?' : 'ug.groupID = ?'}`}
            GROUP BY ug.groupID, p.yearSession, apc.respectiveAuditors;`;

            const queryParams = [year];

            if (!isAdmin) {
                role === 'Auditor' ? queryParams.push(userId) : queryParams.push(groupId);
            }
            logHelper('Get progress', 'progressQuery', AccessLayer.Controllers);
            return await mysql.query(query, queryParams) as RowDataPacket[];
        } catch (error) {
            logHelper('Get progress', 'progressQuery', AccessLayer.Controllers, error, true);
            throw error;
        }
    }
}