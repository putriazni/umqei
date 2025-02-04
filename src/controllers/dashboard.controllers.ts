import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { Request, Response } from "express";
import { DashboardService } from "../services/dashboardService";
import { PeriodService } from "../services/periodService";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";

export async function getAnalytics(req: Request, res: Response) {
  const dummyResponse = {
    ptjAcademic: true,
    summary: [],
    PDCQI: {},
    endDate: {},
    overallWeightage: {},
    indexDetails: {},
  };
  try {
    const groupID = Number(req.query.PTj);
    const yearSession = String(req.query.session);
    const responseType = String(req.query.responseType);
    if (groupID == null || yearSession == null || responseType == null || isNaN(groupID)) {
      const error = { message: "Invalid selection" };
      logHelper(
        `GET ${req.originalUrl}`,
        "getAnalytics",
        AccessLayer.Controllers,
        error,
        true
      );
      return res.status(400).json(error);
    }

    const auditorQuery = 'SELECT groupID from usergroup WHERE role = "Auditor"';
    const [row] = (await mysql.query(auditorQuery)) as RowDataPacket[];
    const auditorIDs = row.map((item: { groupID: number }) => item.groupID);
    let responseTypeNumber: number[];
    if (responseType === "Self-assessment") {
      responseTypeNumber = [groupID];
    } else if (responseType === "Assessment") {
      responseTypeNumber = auditorIDs;
    } else {
      const error = { message: "Invalid request. Invalid response type." };
      logHelper(
        `GET ${req.originalUrl}`,
        "getAnalytics",
        AccessLayer.Controllers,
        error,
        true
      );
      return res.status(400).json(error);
    }
    const ptjAcademicQuery =
      "SELECT ptjAcademic from usergroup WHERE groupID = ?";
    const [ptjAcademicSQL] = (await mysql.query(ptjAcademicQuery, [
      groupID,
    ])) as RowDataPacket[];
    const isPTjAcademic = ptjAcademicSQL[0]?.ptjAcademic === 1;
    let weightage = isPTjAcademic ? "weightage" : "nonAcademicWeightage";
    const filterNonAcademicQuery = ` AND fps.formID IN(SELECT f.formID from form f WHERE f.formType = 0 OR (f.formType = 1 AND f.flag = 0))`;

    const periodSQL = await PeriodService.getSession(yearSession);
    if (!ptjAcademicSQL[0] || !periodSQL) {
      logHelper(
        `GET ${req.originalUrl}`,
        "getAnalytics(dummyResponse)",
        AccessLayer.Controllers
      );
      return res.json(dummyResponse);
    }
    const endDates = {
      auditStartDate: periodSQL.auditStartDate,
      selfAuditStartDate: periodSQL.selfAuditStartDate,
      auditEndDate: periodSQL.auditEndDate,
      selfAuditEndDate: periodSQL.selfAuditEndDate,
    };
    const overallWeightage = {
      enablerWeightage: periodSQL.enablerWeightage,
      resultWeightage: periodSQL.resultWeightage,
    };

    const allFormQueryA1 = `SELECT
    sub.*,
    sub.maxScale * sub.questionCount AS totalMarks`;

    const effectiveWeightage = ", SUM(CASE WHEN sub.questionCount>0 THEN (CASE WHEN ?=false && sub.formType = 1 THEN sub.nonAcademicWeightage ELSE sub.weightage END) ELSE 0 END) OVER(PARTITION BY sub.formType) as effectiveWeightage";

    const allFormQueryA2 = `
    FROM (SELECT
    f.formID,
    f.title,
    f.maxScale,
    f.formType,
    f.weightage,
    f.nonAcademicWeightage,
    CASE
        WHEN f.formType = 0 THEN (
            SELECT COUNT(q.questionID)
            FROM question q
            JOIN sub_criterion sc ON q.subCriterionID = sc.subCriterionID
            JOIN criterion c ON sc.criterionID = c.criterionID
            WHERE c.formID = f.formID
            AND NOT EXISTS (
              SELECT 1
              FROM question_response qr
              WHERE qr.questionID = q.questionID
              AND qr.scale = -2
              AND qr.formResponseID IN (
                SELECT fr.formResponseID
                FROM form_response fr
                WHERE fr.groupID = ?
              )
            )
          )
        WHEN f.formType = 1 THEN (
          SELECT COUNT(rq.resultQuestionID)
          FROM result_question rq
          WHERE rq.formID = f.formID
          AND NOT EXISTS (
            SELECT 1
            FROM result_question_response rqr
            WHERE rqr.resultQuestionID = rq.resultQuestionID
            AND rqr.scale = -2
            AND rqr.formResponseID IN (
              SELECT fr.formResponseID
              FROM form_response fr
              WHERE fr.groupID = ?
            )
          )
        )
    END AS questionCount,
    CASE
      WHEN fr.formID IS NULL THEN 'Pending'
      WHEN fr.submitted = 0 THEN 
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM form_response fr2
          WHERE fr2.groupID IN (SELECT groupID FROM usergroup WHERE role = 'Auditor')
          AND fr2.respectiveGroupID = fr.groupID
          AND fr2.submitted = 0
          AND fr2.formID = fr.formID
          AND TIMESTAMPDIFF(SECOND, fr2.lastUpdatedDate, fr.lastUpdatedDate) <= 1
        ) THEN 'Rejected'
        ELSE 'In Progress'
      END
      WHEN fr.submitted = 1 THEN 'Submitted'
    END AS formFillingStatus,
    fr.lastUpdatedDate,
    COALESCE((
      SELECT SUM(CASE
          WHEN f.formType = 0 THEN qr.scale
          WHEN f.formType = 1 THEN rqr.scale
          ELSE 0
          END)
      FROM form_response fr
      LEFT JOIN question_response qr ON fr.formResponseID = qr.formResponseID AND f.formType = 0 AND qr.scale > -1
      LEFT JOIN result_question_response rqr ON fr.formResponseID = rqr.formResponseID AND f.formType = 1 AND rqr.scale > -1
      WHERE fr.formID = f.formID
        AND fr.groupID = ?
        AND fr.respectiveGroupID = ?
        AND fr.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?)
  ), 0) AS ptjMarks,
  COALESCE((
      SELECT SUM(CASE
          WHEN f.formType = 0 THEN qr.scale
          WHEN f.formType = 1 THEN rqr.scale
          ELSE 0
          END)
      FROM form_response fr
      LEFT JOIN question_response qr ON fr.formResponseID = qr.formResponseID AND f.formType = 0 AND qr.scale > -1
      LEFT JOIN result_question_response rqr ON fr.formResponseID = rqr.formResponseID AND f.formType = 1 AND rqr.scale > -1
      WHERE fr.formID = f.formID
        AND fr.groupID = 2
        AND fr.respectiveGroupID = ?
        AND fr.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?)
  ), 0) AS auditorMarks,
  COALESCE((
    SELECT COUNT(CASE
          WHEN f.formType = 0 THEN qr.questionResponseID
          WHEN f.formType = 1 THEN rqr.resultQuestionResponseID
          ELSE 0
          END)
    FROM form_response fr
    LEFT JOIN question_response qr ON fr.formResponseID = qr.formResponseID AND f.formType = 0 AND qr.scale > -1
    LEFT JOIN result_question_response rqr ON fr.formResponseID = rqr.formResponseID AND f.formType = 1 AND rqr.scale > -1
    WHERE fr.formID = f.formID
      AND fr.groupID IN (?)
      AND fr.respectiveGroupID = ?
      AND fr.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?)
  ), 0) AS questionResponseCount,
  COALESCE((
    SELECT COUNT(CASE
          WHEN f.formType = 0 THEN qr.questionResponseID
          WHEN f.formType = 1 THEN rqr.resultQuestionResponseID
          ELSE 0
          END)
    FROM form_response fr
    LEFT JOIN question_response qr ON fr.formResponseID = qr.formResponseID AND f.formType = 0 AND qr.scale = -2
    LEFT JOIN result_question_response rqr ON fr.formResponseID = rqr.formResponseID AND f.formType = 1 AND rqr.scale = -2
    WHERE fr.formID = f.formID
      AND fr.groupID IN (?)
      AND fr.respectiveGroupID = ?
      AND fr.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?)
  ), 0) AS irrelevantCount
    FROM form f
    LEFT JOIN form_response fr ON f.formID = fr.formID
    AND fr.groupID IN (?)
    AND fr.respectiveGroupID = ?
    AND fr.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?)
    WHERE f.formID IN (SELECT fps.formID from form_period_set fps WHERE yearSession = ?`;

    const allFormQueryA = allFormQueryA1+allFormQueryA2;

    const allFormQueryB = `)) AS sub`;

    const indexQueryA1 = `SELECT
    ROUND(SUM(
    CASE WHEN sub2.formType = 0 THEN
    sub2.ptjMarks/sub2.totalMarks*sub2.weightage/sub2.effectiveWeightage*p.enablerWeightage/(p.enablerWeightage + p.resultWeightage)*100
    ELSE
    sub2.ptjMarks/sub2.totalMarks*sub2.`;

    const indexQueryA2 = `/sub2.effectiveWeightage*p.resultWeightage/(p.enablerWeightage + p.resultWeightage)*100
    END),2) as ptjIndex,
    ROUND(SUM(
     CASE WHEN sub2.formType = 0 THEN
    sub2.auditorMarks/sub2.totalMarks*sub2.weightage/sub2.effectiveWeightage*p.enablerWeightage/(p.enablerWeightage + p.resultWeightage)*100
    ELSE
    sub2.auditorMarks/sub2.totalMarks*sub2.`;

    const indexQueryA3 = `/sub2.effectiveWeightage*p.resultWeightage/(p.enablerWeightage + p.resultWeightage)*100
    END),2) as auditorIndex 
    FROM(${allFormQueryA1}${effectiveWeightage}${allFormQueryA2}`;

    const indexQueryB = `${allFormQueryB}) AS sub2 JOIN period p ON p.yearSession = ?`;

    let [allForms]: RowDataPacket[] = [];
    [allForms] = (await mysql.query(
      allFormQueryA +
        (!isPTjAcademic ? filterNonAcademicQuery : "") +
        allFormQueryB,
      [
        groupID,
        groupID,
        groupID,
        groupID,
        yearSession,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        yearSession,
      ]
    )) as RowDataPacket[];

    const [ownIndex] = (await mysql.query(
      indexQueryA1 +
        weightage +
        indexQueryA2 +
        weightage +
        indexQueryA3 +
        (!isPTjAcademic ? filterNonAcademicQuery : "") +
        indexQueryB,
      [
        isPTjAcademic,
        groupID,
        groupID,
        groupID,
        groupID,
        yearSession,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        responseTypeNumber,
        groupID,
        yearSession,
        yearSession,
        yearSession,
      ]
    )) as RowDataPacket[];

    let formIDsList: number[] = [-1];
    if (allForms[0]?.formID) {
      formIDsList = allForms.map((form: { formID: number }) => form.formID);
    }

    const obtainedPDCQIQuery = `SELECT
  CASE q.questionNumber
      WHEN 0 THEN 'Plan'
      WHEN 1 THEN 'Do'
      WHEN 2 THEN 'CQI'
  END AS PDCQI,
SUM(qr.scale) AS obtained
FROM question_response qr
INNER JOIN question q ON qr.questionID=q.questionID AND qr.scale > -1
WHERE qr.formResponseID IN (
SELECT fr.formResponseID 
  from form_response fr 
  WHERE fr.groupID IN (?) 
  AND fr.respectiveGroupID = ? 
  AND fr.formID IN (SELECT fps.formID FROM form_period_set fps WHERE yearSession = ?))
GROUP BY q.questionNumber`;

    const maxPDCQIQuery = `SELECT 
    COALESCE((SUM(sub.maxPlan)),0) AS Plan,
    COALESCE((SUM(sub.maxDo)),0) AS 'Do',
    COALESCE((SUM(sub.maxCQI)),0) AS 'CQI'
FROM (SELECT
  f.formID,
  f.maxScale*SUM(CASE WHEN q.questionNumber = 0 THEN 1 ELSE 0 END) AS maxPlan,
  f.maxScale*SUM(CASE WHEN q.questionNumber = 1 THEN 1 ELSE 0 END) AS maxDo,
  f.maxScale*SUM(CASE WHEN q.questionNumber = 2 THEN 1 ELSE 0 END) AS maxCQI
  FROM form f
  INNER JOIN criterion c on c.formID=f.formID
  INNER JOIN sub_criterion sc on sc.criterionID=c.criterionID
  INNER JOIN question q on q.subCriterionID=sc.subCriterionID
  WHERE f.formID IN (?)
  AND f.formType = 0
  AND q.questionID NOT IN (
    SELECT qr.questionID
    FROM question_response qr
    INNER JOIN form_response fr ON qr.formResponseID = fr.formResponseID
    INNER JOIN form_period_set fps ON fr.formID = fps.formID AND fps.yearSession = ?
    WHERE fr.groupID = ?
    AND qr.scale = -2
  )
  GROUP BY f.formID)AS sub`;

    const PDCQIresult: Record<string, { total: number; obtained: number }> = {};
    const [obtainedPDCQISQL] = (await mysql.query(obtainedPDCQIQuery, [
      responseTypeNumber,
      groupID,
      yearSession,
    ])) as RowDataPacket[];
    const [maxPDCQISQL] = (await mysql.query(maxPDCQIQuery, [
      formIDsList,
      yearSession,
      groupID,
    ])) as RowDataPacket[];
    for (let i = 0; i < Object.keys(maxPDCQISQL[0]).length; i++) {
      const { PDCQI, obtained = 0 } =
        obtainedPDCQISQL.length > i
          ? obtainedPDCQISQL[i]
          : { PDCQI: Object.keys(maxPDCQISQL[0])[i] };
      const max = maxPDCQISQL[0][PDCQI];

      PDCQIresult[PDCQI] = { obtained, total: max };
    }

    const obtainedLTCQuery = `SELECT
LTC,
SUM(obtained) AS obtained
FROM (
SELECT
  CASE (rq.resultQuestionNumber MOD 3)
    WHEN 1 THEN 'Level'
    WHEN 2 THEN 'Trend'
    WHEN 0 THEN 'Comparison'
  END AS LTC,
  rqr.scale AS obtained
FROM result_question_response rqr
INNER JOIN result_question rq ON rqr.resultQuestionID = rq.resultQuestionID AND rqr.scale > -1
WHERE rqr.formResponseID IN (
  SELECT fr.formResponseID 
  FROM form_response fr 
  WHERE fr.groupID IN (?) 
    AND fr.respectiveGroupID = ?
    AND fr.formID IN (SELECT fps.formID FROM form_period_set fps WHERE yearSession = ?)
)
) AS subquery
GROUP BY LTC;`;

    const maxLTCQuery = `SELECT 
COALESCE((SUM(sub.maxLevel)),0) AS 'Level',
COALESCE((SUM(sub.maxTrend)),0) AS 'Trend',
COALESCE((SUM(sub.maxComparison)),0) AS 'Comparison'
FROM (SELECT
f.formID,
f.maxScale*SUM(CASE WHEN rq.resultQuestionNumber MOD 3 = 1 THEN 1 ELSE 0 END) AS maxLevel,
f.maxScale*SUM(CASE WHEN rq.resultQuestionNumber MOD 3 = 2 THEN 1 ELSE 0 END) AS maxTrend,
f.maxScale*SUM(CASE WHEN rq.resultQuestionNumber MOD 3 = 0 THEN 1 ELSE 0 END) AS maxComparison
FROM form f
INNER JOIN result_question rq on f.formID=rq.formID
WHERE f.formID IN (?)
AND f.formType = 1
AND rq.resultQuestionID NOT IN (
SELECT rqr.resultQuestionID
FROM result_question_response rqr
INNER JOIN form_response fr ON rqr.formResponseID = fr.formResponseID
INNER JOIN form_period_set fps ON fr.formID = fps.formID AND fps.yearSession = ?
WHERE fr.groupID = ?
AND rqr.scale = -2
)
GROUP BY f.formID)AS sub;`;

    const LTCresult: Record<string, { total: number; obtained: number }> = {};
    const [obtainedLTCSQL] = (await mysql.query(obtainedLTCQuery, [
      responseTypeNumber,
      groupID,
      yearSession,
    ])) as RowDataPacket[];
    const [maxLTCSQL] = (await mysql.query(maxLTCQuery, [
      formIDsList,
      yearSession,
      groupID,
    ])) as RowDataPacket[];
    for (let i = 0; i < Object.keys(maxLTCSQL[0]).length; i++) {
      const { LTC, obtained = 0 } =
        obtainedLTCSQL.length > i
          ? obtainedLTCSQL[i]
          : { LTC: Object.keys(maxLTCSQL[0])[i] };
      const max = maxLTCSQL[0][LTC];
      LTCresult[LTC] = { obtained, total: max };
    }

    const lastSessionQuery = `SELECT 
  p.yearSession from period p 
  WHERE p.auditEndDate < 
  (SELECT p.selfAuditStartDate 
  from period p WHERE p.yearSession = ?) 
  ORDER BY p.auditEndDate DESC LIMIT 1;`;

    const [lastSessionSQL] = (await mysql.query(lastSessionQuery, [
      yearSession,
    ])) as RowDataPacket[];

    let [lastYearIndex]: RowDataPacket[] = [];
    if (lastSessionSQL[0] && lastSessionSQL[0].yearSession) {
      [lastYearIndex] = (await mysql.query(
        indexQueryA1 +
        weightage +
        indexQueryA2 +
        weightage +
        indexQueryA3 +
          (!isPTjAcademic ? filterNonAcademicQuery : "") +
          indexQueryB,
        [
          isPTjAcademic,
          groupID,
          groupID,
          groupID,
          groupID,
          lastSessionSQL[0].yearSession,
          groupID,
          lastSessionSQL[0].yearSession,
          responseTypeNumber,
          groupID,
          lastSessionSQL[0].yearSession,
          responseTypeNumber,
          groupID,
          lastSessionSQL[0].yearSession,
          responseTypeNumber,
          groupID,
          lastSessionSQL[0].yearSession,
          lastSessionSQL[0].yearSession,
          lastSessionSQL[0].yearSession,
        ]
      )) as RowDataPacket[];
    }

    //to find out all ptj of the session submitted all forms/completly audited

    const academicForm = `SELECT fps.formID FROM form_period_set fps WHERE fps.yearSession = ?`;
    const nonAcademicForm = `SELECT fps.formID FROM form_period_set fps INNER JOIN form f ON f.formID = fps.formID AND (f.formType=0 OR (f.formType=1 AND f.flag=0)) WHERE fps.yearSession = ?`;
    //Find which forms are required to be filled in order to be considered as 100% completion. Refer how many objects to know the number of forms to be filled.
    const potentialCompletedGroups = `SELECT 
  fr.groupID, COUNT(1) AS count, ug.ptjAcademic 
  from form_response fr INNER JOIN usergroup ug ON ug.groupID = fr.groupID 
  AND ug.role="PTJ" WHERE fr.formID IN 
  (SELECT fps.formID FROM form_period_set fps WHERE fps.yearSession = ?) 
  AND fr.submitted=1 GROUP BY fr.groupID`;
    //This query gives each ptj(who has at least 1 form_response record) has how many forms submitted=1 for that session, and also ptjAcademic
    const potentialCompletedAudits = `SELECT
  fr.respectiveGroupID, COUNT(1) AS count, ug.ptjAcademic
  from form_response fr INNER JOIN usergroup ug ON ug.groupID = fr.respectiveGroupID
  WHERE fr.formID IN (SELECT fps.formID FROM form_period_set fps WHERE fps.yearSession = ?)
  AND fr.groupID IN (SELECT ug2.groupID from usergroup ug2 WHERE ug2.role = "Auditor")
  AND fr.submitted=1 GROUP BY fr.respectiveGroupID`;
    const [academicFormSQL] = (await mysql.query(academicForm, [
      yearSession,
    ])) as RowDataPacket[];
    const [nonAcademicFormSQL] = (await mysql.query(nonAcademicForm, [
      yearSession,
    ])) as RowDataPacket[];
    const academicFormCount = academicFormSQL.length;
    const nonAcademicFormCount = nonAcademicFormSQL.length;
    let ptjCount = 0;
    let totalIndex = 0;
    let completed = false;

    if (responseType === "Self-assessment") {
      const [potentialCompletedGroupsSQL] = (await mysql.query(
        potentialCompletedGroups,
        [yearSession]
      )) as RowDataPacket[];
      const completedGroups = potentialCompletedGroupsSQL.filter(
        (item: { count: number; ptjAcademic: boolean }) =>
          (item.ptjAcademic && item.count === academicFormCount) ||
          (!item.ptjAcademic && item.count === nonAcademicFormCount)
      );
      ptjCount = completedGroups.length;
      for (let i = 0; i < ptjCount; i++) {
        weightage = completedGroups[i].ptjAcademic
          ? "weightage"
          : "nonAcademicWeightage";
        const [indexSQL] = (await mysql.query(
          indexQueryA1 +
          weightage +
          indexQueryA2 +
          weightage +
          indexQueryA3 +
            (completedGroups[i].ptjAcademic ? "" : filterNonAcademicQuery) +
            indexQueryB,
          [
            completedGroups[i].ptjAcademic,
            completedGroups[i].groupID,
            completedGroups[i].groupID,
            completedGroups[i].groupID,
            completedGroups[i].groupID,
            yearSession,
            completedGroups[i].groupID,
            yearSession,
            [completedGroups[i].groupID],
            completedGroups[i].groupID,
            yearSession,
            [completedGroups[i].groupID],
            completedGroups[i].groupID,
            yearSession,
            [completedGroups[i].groupID],
            completedGroups[i].groupID,
            yearSession,
            yearSession,
            yearSession,
          ]
        )) as RowDataPacket[];
        totalIndex += indexSQL[0].ptjIndex;
      }
      completed = completedGroups
        .map(
          (item: { groupID: number; count: number; ptjAcademic: boolean }) =>
            item.groupID
        )
        .includes(groupID);
    } else if (responseType === "Assessment") {
      const [potentialCompletedAuditsSQL] = (await mysql.query(
        potentialCompletedAudits,
        [yearSession]
      )) as RowDataPacket[];
      const completedAudits = potentialCompletedAuditsSQL.filter(
        (item: { count: number; ptjAcademic: boolean }) =>
          (item.ptjAcademic && item.count === academicFormCount) ||
          (!item.ptjAcademic && item.count === nonAcademicFormCount)
      );
      ptjCount = completedAudits.length;
      for (let i = 0; i < ptjCount; i++) {
        weightage = completedAudits[i].ptjAcademic
          ? "weightage"
          : "nonAcademicWeightage";
        const [indexSQL] = (await mysql.query(
          indexQueryA1 +
          weightage +
          indexQueryA2 +
          weightage +
          indexQueryA3 +
            (completedAudits[i].ptjAcademic ? "" : filterNonAcademicQuery) +
            indexQueryB,
          [
            completedAudits[i].ptjAcademic,
            completedAudits[i].respectiveGroupID,
            completedAudits[i].respectiveGroupID,
            completedAudits[i].respectiveGroupID,
            completedAudits[i].respectiveGroupID,
            yearSession,
            completedAudits[i].respectiveGroupID,
            yearSession,
            auditorIDs,
            completedAudits[i].respectiveGroupID,
            yearSession,
            auditorIDs,
            completedAudits[i].respectiveGroupID,
            yearSession,
            auditorIDs,
            completedAudits[i].respectiveGroupID,
            yearSession,
            yearSession,
            yearSession,
          ]
        )) as RowDataPacket[];
        totalIndex += indexSQL[0].auditorIndex;
      }
      completed = completedAudits
        .map(
          (item: {
            respectiveGroupID: number;
            count: number;
            ptjAcademic: boolean;
          }) => item.respectiveGroupID
        )
        .includes(groupID);
    }
    const indexDetails = {
      index:
        responseType === "Self-assessment"
          ? ownIndex[0].ptjIndex
          : ownIndex[0].auditorIndex,
      lastYearSession: lastSessionSQL[0]?.yearSession ?? undefined,
      lastYearIndex: lastYearIndex
        ? responseType === "Self-assessment"
          ? lastYearIndex[0].ptjIndex
          : lastYearIndex[0].auditorIndex
        : undefined,
      ptjCount: ptjCount,
      average: ptjCount > 0 ? totalIndex / ptjCount : undefined,
      completed: completed,
    };

    const dashboardData = {
      ptjAcademic: isPTjAcademic || groupID === 0,
      summary: allForms,
      PDCQI: Object.keys(PDCQIresult).length > 0 ? PDCQIresult : undefined,
      endDate: endDates,
      overallWeightage: overallWeightage,
      LTC: Object.keys(LTCresult).length > 0 ? LTCresult : undefined,
      indexDetails: indexDetails,
    };
    logHelper(
      `GET ${req.originalUrl}`,
      "getAnalytics",
      AccessLayer.Controllers
    );
    return res.json(dashboardData);
  } catch (error) {
    console.log(error);
    logHelper(
      `GET ${req.originalUrl}`,
      "getAnalytics",
      AccessLayer.Controllers,
      error,
      true
    );
    return res.status(500).json({ message: (error as Error).message });
  }
}

export async function getSelection(req: Request, res: Response) {
  const groupID = Number(req.params.groupID);
  const userID = Number(req.params.userID);
  try {
    const userRole = await DashboardService.getUserRole(groupID);
    const yearQuery = `SELECT yearSession
      FROM period
      WHERE NOW() >= selfAuditStartDate
      ORDER BY 
        CASE
          WHEN NOW() BETWEEN selfAuditStartDate AND auditEndDate THEN 0
          ELSE ABS(TIMESTAMPDIFF(SECOND, NOW(), selfAuditStartDate))
        END;`;
    const [yearRows] = (await mysql.query(yearQuery)) as RowDataPacket[];
    let IDNameQuery =
      "SELECT groupID, groupName from usergroup WHERE groupID = ?";
    let IDNameQueryParams = [groupID];
    if (userRole === "Admin") {
      IDNameQuery =
        'SELECT groupID,groupName from usergroup WHERE role = "PTJ"';
      IDNameQueryParams = [];
    } else if (userRole === "Auditor") {
      IDNameQuery =
        "SELECT ug.groupID, ug.groupName from usergroup ug WHERE groupID IN (SELECT apc.ptjGroupID from auditor_ptj_comments apc WHERE apc.auditorUserID = ?)";
      IDNameQueryParams = [userID];
    }
    const [IDNameRows] = (await mysql.query(
      IDNameQuery,
      IDNameQueryParams
    )) as RowDataPacket[];
    const rows = {
      IDName: IDNameRows,
      year: yearRows,
    };
    logHelper(
      `GET ${req.originalUrl}`,
      "getSelection",
      AccessLayer.Controllers
    );
    return res.json(rows);
  } catch (error) {
    logHelper(
      `GET ${req.originalUrl}`,
      "getSelection",
      AccessLayer.Controllers,
      error,
      true
    );
    return res.status(500).json({ message: (error as Error).message });
  }
}

export async function getEditDashboard(req: Request, res: Response) {
  try {
    const result = await DashboardService.getEditDashboard();
    logHelper(
      `GET ${req.originalUrl}`,
      "getEditDashboard",
      AccessLayer.Controllers
    );
    return res.json(result);
  } catch (error) {
    logHelper(
      `GET ${req.originalUrl}`,
      "getEditDashboard",
      AccessLayer.Controllers,
      error,
      true
    );
    return res.status(500).json({
      message:
        "Error retrieving edit dashboard data - " + (error as Error).message,
    });
  }
}

export async function updateEditDashboard(req: Request, res: Response) {
  try {
    const data = req.body;
    const result = await DashboardService.updateEditDashboard(data);
    logHelper(
      `POST ${req.originalUrl}`,
      "updateEditDashboard",
      AccessLayer.Controllers,
      result,
      true
    );
    if (Array.isArray(result)) {
      return res.status(500).json({
        message:
          "Edit dashboard data partially updated with errors : " + result,
      });
    } else if (result) {
      return res.json({ message: "Edit dashboard data updated successfully" });
    } else {
      return res
        .status(500)
        .json({ message: "Error updating edit dashboard data - " + result });
    }
  } catch (error) {
    logHelper(
      `POST ${req.originalUrl}`,
      "updateEditDashboard",
      AccessLayer.Controllers,
      error,
      true
    );
    return res.status(500).json({
      message:
        "Error updating edit dashboard data - " + (error as Error).message,
    });
  }
}
