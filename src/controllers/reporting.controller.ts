import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { Request, Response } from "express";
import { ReportTable } from "../interface/Reporting";
import { DashboardService } from "../services/dashboardService";
import { PeriodService } from "../services/periodService";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";

export async function getPTjSessionInfo(req: Request, res: Response) {
  try {
    const groupID = Number(req.params.groupID);
    const session = decodeURIComponent(req.params.session);
    const dummyPeriod = {
      yearSession: session,
      year: "1970",
      auditStartDate: "1970-01-01T00:00:00.000Z",
      auditEndDate: "1970-01-01T00:00:00.000Z",
      selfAuditStartDate: "1970-01-01T00:00:00.000Z",
      selfAuditEndDate: "1970-01-01T00:00:00.000Z",
      enablerWeightage: 0,
      resultWeightage: 0,
    };
    const ptjName = await DashboardService.getPTjName(groupID);
    const selfAssessorList = await DashboardService.getSelfAuditorList(groupID);
    const assessorNameList: string[] = await DashboardService.getAuditorList(
      groupID,
      session
    );
    const reflectionActionList = await DashboardService.getReflectionActionList(
      groupID,
      session
    );
    const recommendationCommentList = await DashboardService.getRecommendationCommentList(
      groupID,
      session
    );
    const auditorCommentList = await DashboardService.getAuditorCommentList(
      groupID,
      session
    );
    const period = (await PeriodService.getSession(session)) ?? dummyPeriod;

    const isCurrentSession = new Date() >= new Date(period.selfAuditStartDate) && new Date() <= new Date(period.auditEndDate);

    res.json({
      ptjName,
      selfAssessorList,
      assessorNameList,
      period,
      isCurrentSession,
      reflectionActionList,
      recommendationCommentList,
      auditorCommentList,
    });
    logHelper(
      `GET ${req.originalUrl}`,
      "getPTjSessionInfo",
      AccessLayer.Controllers
    );
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    logHelper(
      `GET ${req.originalUrl}`,
      "getPTjSessionInfo",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export async function getReportList(req: Request, res: Response) {
  const userID = Number(req.params.userID);
  const groupID = Number(req.params.groupID);
  const reportListQuery = `WITH FormsToBeFilled AS (
    SELECT DISTINCT
	  fps.yearSession,
    f.formType,
    f.flag,
    fps.formID AS formToBeFilled
    FROM form_period_set fps
    INNER JOIN 
    form f ON f.formID = fps.formID),
UnverifiedList AS (SELECT
        ug.groupID,
        ug.groupName,
        ug.ptjAcademic,
        p.yearSession,
        'Self-Assessed' AS reportStatus
    FROM
        usergroup ug
    CROSS JOIN
        period p
    LEFT JOIN
        FormsToBeFilled ftf ON p.yearSession = ftf.yearSession
    LEFT JOIN
        form_response fr ON ftf.formToBeFilled = fr.formID
            AND fr.groupID = ug.groupID
            AND fr.submitted = 1
            AND fr.groupID > 2
    GROUP BY
        ug.groupID, ug.groupName, p.yearSession
    HAVING
        (
          CASE WHEN ug.ptjAcademic = 1 THEN
            COUNT(DISTINCT ftf.formToBeFilled) = COUNT(DISTINCT fr.formID)
          ELSE
            SUM(CASE
                WHEN ftf.formType = 0 OR (ftf.formType = 1 AND ftf.flag = 0) THEN 1
                ELSE 0
            END) = COUNT(DISTINCT fr.formID)
          END
            AND COUNT(DISTINCT fr.formID) > 0
        )
),
VerifiedList AS (SELECT
  ug.groupID,
  ug.groupName,
  ug.ptjAcademic,
  p.yearSession,
  'Assessed' AS reportStatus
FROM
  usergroup ug
CROSS JOIN
  period p
LEFT JOIN
  FormsToBeFilled ftf ON p.yearSession = ftf.yearSession
LEFT JOIN
  form_response fr ON ftf.formToBeFilled = fr.formID
AND fr.groupID = ug.groupID
      AND fr.submitted = 1
      AND fr.groupID >= 2
LEFT JOIN
  form_response fr2 ON ftf.formToBeFilled = fr2.formID
      AND fr2.groupID IN (SELECT groupID from usergroup WHERE role = "Auditor")
      AND fr2.respectiveGroupID = ug.groupID
      AND fr2.submitted = 1
GROUP BY
  ug.groupID, ug.groupName, p.yearSession
HAVING
  (
CASE WHEN ug.ptjAcademic = 1 THEN
  COUNT(DISTINCT ftf.formToBeFilled) = COUNT(DISTINCT fr.formID) AND COUNT(DISTINCT fr.formID) = COUNT(DISTINCT fr2.formID) 
      ELSE
  SUM(CASE
    WHEN ftf.formType = 0 OR (ftf.formType = 1 AND ftf.flag = 0) THEN 1
    ELSE 0
  END) = COUNT(DISTINCT fr.formID) AND COUNT(DISTINCT fr.formID) = COUNT(DISTINCT fr2.formID) 
      END
      AND COUNT(DISTINCT fr.formID) > 0
  )
)
SELECT vl.groupID, vl.groupName, CASE WHEN vl.ptjAcademic=1 THEN "Academic" ELSE "Non-Academic" END AS ptjAcademic, vl.yearSession, vl.reportStatus FROM VerifiedList vl WHERE vl.groupID IN (SELECT DISTINCT groupID FROM UnverifiedList)
UNION ALL
SELECT ul.groupID, ul.groupName, CASE WHEN ul.ptjAcademic=1 THEN "Academic" ELSE "Non-Academic" END AS ptjAcademic, ul.yearSession, ul.reportStatus FROM UnverifiedList ul WHERE ul.groupID NOT IN (SELECT DISTINCT groupID FROM VerifiedList)`;
  try {
    interface ReportAccess {
      ptjGroupID: number;
      yearSession: string;
    }
    const groupIDList: number[] = [];
    const auditorReportAccess : ReportAccess[] = [];
    const userRole = await DashboardService.getUserRole(groupID);
    const [reportList] = (await mysql.query(
      reportListQuery
    )) as RowDataPacket[];
    if (userRole === "PTJ") {
      groupIDList.push(groupID);
    } else if (userRole === "Auditor") {
        const auditorInChargeGroupYearQuery = `SELECT apc.ptjGroupID, apc.yearSession FROM auditor_ptj_comments apc WHERE apc.auditorUserID = ?`;
        const [auditorInChargeGroupYear] = (await mysql.query(
          auditorInChargeGroupYearQuery,
          [userID]
        )) as RowDataPacket[];
        auditorInChargeGroupYear.forEach((item: RowDataPacket) => {
          auditorReportAccess.push({ptjGroupID: item.ptjGroupID, yearSession: item.yearSession});
        });
    }
    const filteredList = reportList.filter((item: ReportTable) =>
      groupIDList.includes(item.groupID)
    );
    const auditorList = reportList.filter(
      (item: ReportTable) => auditorReportAccess.findIndex((access: ReportAccess) => access.ptjGroupID === item.groupID && access.yearSession === item.yearSession) !== -1
    );
    userRole === "Admin"
      ? res.json(reportList)
      : userRole === "Auditor"
      ? res.json(auditorList)
      : res.json(filteredList);
    logHelper(
      `GET ${req.originalUrl}`,
      "getReportList",
      AccessLayer.Controllers
    );
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    logHelper(
      `GET ${req.originalUrl}`,
      "getReportList",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}
