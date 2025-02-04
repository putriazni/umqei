import {
  Criterion,
  Form,
  Question,
  ResultQuestion,
  SubCriterion,
} from "../interface/Form";
import { SchedularService } from "../services/schedularService";
import { FormService } from "../services/formService";
import { PeriodService } from "../services/periodService";
import { Period } from "../interface/Period";
import { FormPeriodSetType, NewData, NewResult } from "../constants/dataType";
import fs from "node:fs/promises";
import path from "path";
import { FormContentService } from "../services/formContentService";
import { AccessLayer } from "../constants/global";
import { logHelper } from "../middleware/logger";
import { mail, mailTemplates } from "../middleware/mailer";

export async function isNewSessionStart() {
  try {
    const currentDate = new Date();

    const result = await PeriodService.getCurrentPeriodSession();
    const currentPeriodSession: Period = result[0] as Period;

    if (currentPeriodSession !== undefined) {
      const { selfAuditStartDate } = currentPeriodSession;

      const newSessionStartDate = new Date(selfAuditStartDate);

      if (currentDate >= newSessionStartDate) {
        return currentPeriodSession.yearSession;
      }
    }
    return null;
  } catch (error) {
    console.error(error);
    logHelper(
      "check whether new session is start",
      "isNewSessionStart",
      AccessLayer.Controllers,
      error
    );
  }
}

export async function extractClonedForm(session: string) {
  try {
    let clonedData: FormPeriodSetType[] = [];
    const activeForms = await FormService.getActiveForms();

    if (Array.isArray(activeForms)) {
      clonedData = activeForms.map((form: Form) => [form.formID, session]);
    }

    return clonedData;
  } catch (error) {
    console.log(error);
    logHelper(
      "extract cloned form",
      "extractClonedForm",
      AccessLayer.Controllers,
      error
    );
  }
}

export async function checkAndClone(
  session: string,
  clonedSet: FormPeriodSetType[],
  cloneForm?: boolean
) {
  const needToClone = cloneForm ?? false;
  try {
    const setObject = await SchedularService.isDuplicated(session);

    if (Array.isArray(setObject)) {
      if (setObject.length === 0) {
        if (needToClone) {
          await cloneFormAndContent();
        }
        await SchedularService.clone(clonedSet);
      } else {
        return 0;
      }
    }
  } catch (error) {
    console.log(error);
    logHelper(
      "check and clone",
      "checkAndClone",
      AccessLayer.Controllers,
      error
    );
  }
}

export async function removeIdleFiles() {
  const files = await fs.readdir("../resources");
  const currentTime = new Date().getTime();
  const timeRange = 24 * 60 * 60 * 1000;
  for (let i = 0; i < files.length; i++) {
    if (files[i] === "attachment") continue;
    if (files[i] === "evidence") continue;
    if (files[i] === "result_evidence") continue;
    if (files[i] === "log") continue;
    const fullPath = path.join("../resources", files[i]);
    const fileStat = await fs.stat(fullPath);
    const modifiedTime = new Date(fileStat.mtime).getTime(); // Get modified time in milliseconds
    // Calculate the time difference in milliseconds
    const timeDifference = currentTime - modifiedTime;

    // If the time difference is greater than 24 hours (in milliseconds), delete the file
    if (timeDifference > timeRange) {
      // 24 hours in milliseconds
      await fs.rm(fullPath);
    }
  }
}

async function cloneFormAndContent() {
  try {
    // Extract current active form
    console.log("Cloning form and form content...");
    let formIDs: number[] = [];
    const forms = await FormService.getActiveForms();

    if (Array.isArray(forms)) {
      formIDs = forms.map((form) => form.formID);
    }

    for (const formId of formIDs) {
      const targetForm = await FormService.getFormInfo(formId);

      const newForm = [
        [
          targetForm.title,
          targetForm.formDefinition,
          targetForm.formType,
          targetForm.formNumber,
          targetForm.formStatus,
          targetForm.minScale,
          targetForm.maxScale,
          targetForm.weightage,
          targetForm.flag,
          targetForm.nonAcademicWeightage,
        ],
      ];
      // Clone form information
      const newFormId = await FormService.createNewForm(newForm);

      // Clone form content
      if (targetForm.formType === 0) {
        const criterions = await FormContentService.getCriterions(formId);

        const criterionIDs = criterions.map(
          (criterion: Criterion) => criterion.criterionID
        );

        const subCriterionPromises = criterionIDs.map((criterionID: number) =>
          FormContentService.getSubCriterions(criterionID)
        );
        const subCriterionResults = await Promise.all(subCriterionPromises);

        const subCriterions = subCriterionResults.flatMap((result) => result);

        const subCriterionIDs = subCriterions
          .filter(
            (subCriterion: SubCriterion) =>
              subCriterion && subCriterion.subCriterionID !== undefined
          )
          .map((subCriterion: SubCriterion) => subCriterion.subCriterionID);

        const questionPromises = subCriterionIDs.map((subCriterionID: number) =>
          FormContentService.getQuestion(subCriterionID)
        );
        const questionResults = await Promise.all(questionPromises);

        const questions = questionResults.flatMap((result: Question) => result);

        const details = {
          criterion: criterions.map((criterion: Criterion) => ({
            criterionID: criterion.criterionID,
            description: criterion.description,
            criterionNumber: criterion.criterionNumber,
            criterionStatus: criterion.criterionStatus,
            subCriterions: subCriterions
              .filter(
                (subCriterion: SubCriterion) =>
                  subCriterion.criterionID === criterion.criterionID
              )
              .map((subCriterion: SubCriterion) => ({
                subCriterionID: subCriterion.subCriterionID,
                description: subCriterion.description,
                subCriterionNumber: subCriterion.subCriterionNumber,
                subCriterionStatus: subCriterion.subCriterionStatus,
                questions: questions
                  .filter(
                    (question: Question) =>
                      question.subCriterionID === subCriterion.subCriterionID
                  )
                  .map(({ subCriterionID, ...rest }) => rest),
              })),
          })),
        };

        const listOfCriterions = details.criterion;
        const newQuestions: NewData[] = [];
        let criterionNumbering = 1;

        for (const criterion of listOfCriterions) {
          const { description, criterionStatus } = criterion;

          const payloadSubCriterions = [...[criterion.subCriterions]];

          const newCriterion: NewData = [
            description,
            criterionNumbering,
            criterionStatus,
            newFormId,
          ];
          const insertedCriterionId = await FormContentService.createCriterion(
            newCriterion
          );

          let subCriterionNumbering = 1;
          const listOfSubCriterions = payloadSubCriterions.flatMap(
            (subCriterionsArray) => subCriterionsArray
          );
          if (listOfSubCriterions.length !== 0) {
            for (const payloadSubCriterion of listOfSubCriterions) {
              const payloadQuestions = payloadSubCriterion.questions;

              const newSubCriterion: NewData = [
                payloadSubCriterion.description,
                subCriterionNumbering,
                payloadSubCriterion.subCriterionStatus,
                insertedCriterionId,
              ];

              const insertedSubCriterionId =
                await FormContentService.createSubCriterion(newSubCriterion);

              for (const payloadQuestion of payloadQuestions) {
                const newQuestion: NewData = [
                  payloadQuestion.description,
                  payloadQuestion.questionNumber,
                  payloadQuestion.questionStatus,
                  insertedSubCriterionId,
                  payloadQuestion.exampleEvidence,
                ];
                newQuestions.push(newQuestion);
              }
              subCriterionNumbering++;
            }
          }
          criterionNumbering++;
        }

        if (newQuestions.length !== 0) {
          await FormContentService.createQuestion(newQuestions);
        }
      } else if (targetForm.formType === 1) {
        const results = await FormContentService.getResultQuestion(formId);

        if (newFormId) {
          const resultQuestions = results.map((result: ResultQuestion) => {
            const { questionID, ...resultData } = result;
            return resultData;
          });

          const values: NewResult[] = [];
          let numbering = 1;

          for (const newResultQuestion of resultQuestions) {
            const { title, description, refCode, resultQuestionStatus } =
              newResultQuestion;

            const newResult: NewResult = [
              title,
              description,
              refCode,
              numbering,
              resultQuestionStatus,
              newFormId,
            ];

            values.push(newResult);
            numbering++;
          }

          if (values.length > 0) {
            await FormContentService.createResult(values);
          }
        }
      }

      await FormService.deactivateForm(formId);
    }
  } catch (error) {
    console.log(error);
    logHelper(
      "clone form and form content",
      "cloneFormAndContent",
      AccessLayer.Controllers,
      error
    );
  }
}

export async function checkAndNotifyExpiring() {
  //Checking every 12am of the day. Therefore the notification will be received by the users between 4days1minute(if 11:59pm) - 5 days(if 12am) before the deadline.
  const result = await PeriodService.getCurrentPeriodSession();
  const currentPeriodSession: Period = result[0] as Period;
  if (currentPeriodSession !== undefined) {
    const {
      auditEndDate,
      selfAuditEndDate,
      yearSession,
      auditStartDate,
      selfAuditStartDate,
    } = currentPeriodSession;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const auditEndDateObj = new Date(auditEndDate);
    const selfAuditEndDateObj = new Date(selfAuditEndDate);
    const oneDay = 24 * 60 * 60 * 1000;
    if (
      selfAuditEndDateObj.getTime() - currentDate.getTime() > 4 * oneDay &&
      selfAuditEndDateObj.getTime() - currentDate.getTime() <= 5 * oneDay
    ) {
      const mailOptions =
        await mailTemplates.allUser.selfAssessmentAlmostExpire(
          yearSession,
          selfAuditStartDate + " ~ " + selfAuditEndDate
        );
      mail.sendMail(mailOptions, (error, info) => {
        if (error) {
          logHelper(
            "Self assessment almost expire : " + info,
            "selfAssessmentAlmostExpire",
            AccessLayer.Services,
            error,
            true
          );
        } else {
          logHelper(
            "Self assessment almost expire : " + info,
            "selfAssessmentAlmostExpire",
            AccessLayer.Services
          );
        }
      });
    }
    if (
      auditEndDateObj.getTime() - currentDate.getTime() > 4 * oneDay &&
      auditEndDateObj.getTime() - currentDate.getTime() <= 5 * oneDay
    ) {
      const mailOptions = await mailTemplates.allUser.assessmentAlmostExpire(
        yearSession,
        auditStartDate + " ~ " + auditEndDate
      );
      mail.sendMail(mailOptions, (error, info) => {
        if (error) {
          logHelper(
            "Assessment almost expire : " + info,
            "assessmentAlmostExpire",
            AccessLayer.Services,
            error,
            true
          );
        } else {
          logHelper(
            "Assessment almost expire : " + info,
            "assessmentAlmostExpire",
            AccessLayer.Services
          );
        }
      });
    }
  }
}
