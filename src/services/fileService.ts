import * as utils from "../utils/utils.db";
import { Table } from "../constants/global";
import { FileFormat } from "../interface/File";
import { Attachment } from "../interface/Announcement";
import dotenv from "dotenv";
import fs from "fs";
import { Evidence, ResultEvidence } from "../interface/FormReview";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";

dotenv.config();
export const FileService = {
  async createAttachment(id: number, attachments: FileFormat[]) {
    const totalUploadedFiles: [string, number, string][] = [];
    const directory = process.env.UPLOADS_DIRECTORY + "/resources";
    const idDirectory = "/attachment/" + id;
    const attachmentDirectory = directory + idDirectory;

    if (!fs.existsSync(attachmentDirectory)) {
      fs.mkdirSync(attachmentDirectory);
    }

    attachments.forEach((attachment) => {
      const existingDirectory = directory + "/" + attachment.path;
      const newDirectory = attachmentDirectory + "/" + attachment.path;
      if (fs.existsSync(existingDirectory)) {
        fs.renameSync(existingDirectory, newDirectory);
        totalUploadedFiles.push([attachment.filename, id, attachment.path]);
      }
    });
    console.log("totalUploadedFiles", totalUploadedFiles);

    const result = await utils.insert(
      Table.Attachment,
      ["filename", "announcementID", "filepath"],
      totalUploadedFiles
    );
    if (result && attachments.length === 1)
      //When only one file is uploaded, result is the attachmentID. To avoid confusion, return 1 to remain consistent
      //So that all cases return the number of rows inserted
      return 1;
    else return result;
  },

  async createEvidence(id: number, evidences: FileFormat[]) {
    const totalUploadedFiles: [string, number, string][] = [];
    const directory = process.env.UPLOADS_DIRECTORY + "/resources";
    const idDirectory = "/evidence/" + id;
    const evidenceDirectory = directory + idDirectory;

    if (!fs.existsSync(evidenceDirectory)) {
      fs.mkdirSync(evidenceDirectory);
    }

    evidences.forEach((evidence) => {
      const existingDirectory = directory + "/" + evidence.path;
      const newDirectory = evidenceDirectory + "/" + evidence.path;
      if (fs.existsSync(existingDirectory)) {
        fs.renameSync(existingDirectory, newDirectory);
        totalUploadedFiles.push([evidence.filename, id, evidence.path]);
      }
    });

    const result = await utils.insert(
      Table.Evidence,
      ["filename", "questionResponseID", "filepath"],
      totalUploadedFiles
    );
    if (result && evidences.length === 1)
      //When only one file is uploaded, result is the attachmentID. To avoid confusion, return 1 to remain consistent
      //So that all cases return the number of rows inserted
      return 1;
    else return result;
  },

  async createResultEvidence(id: number, resultEvidences: FileFormat[]) {
    const totalUploadedFiles: [string, number, string][] = [];
    const directory = process.env.UPLOADS_DIRECTORY + "/resources";
    const idDirectory = "/result_evidence/" + id;
    const resultEvidenceDirectory = directory + idDirectory;

    if (!fs.existsSync(resultEvidenceDirectory)) {
      fs.mkdirSync(resultEvidenceDirectory);
    }

    resultEvidences.forEach((evidence) => {
      const existingDirectory = directory + "/" + evidence.path;
      const newDirectory = resultEvidenceDirectory + "/" + evidence.path;
      if (fs.existsSync(existingDirectory)) {
        fs.renameSync(existingDirectory, newDirectory);
        totalUploadedFiles.push([evidence.filename, id, evidence.path]);
      }
    });

    const result = await utils.insert(
      Table.ResultEvidence,
      ["filename", "resultQuestionResponseID", "filepath"],
      totalUploadedFiles
    );
    if (result && resultEvidences.length === 1)
      //When only one file is uploaded, result is the attachmentID. To avoid confusion, return 1 to remain consistent
      //So that all cases return the number of rows inserted
      return 1;
    else return result;
  },

  async getAttachment(id: number) {
    const result = await utils.retrieve(Table.Attachment, "*", {
      column: "announcementID",
      value: id,
    });
    return result as unknown as Attachment;
  },

  async getFilePath(id: number, table: Table, idName: string) {
    const result = await utils.retrieve(table, ["filepath", "filename"], {
      column: idName,
      value: id,
    });
    return result?.[0] ?? {};
  },

  async getAttachmentInfo(id: number) {
    const result = await utils.retrieve(
      Table.Attachment,
      ["attachmentID", "filename"],
      {
        column: "announcementID",
        value: id,
      }
    );
    return result;
  },

  async getEvidenceInfo(id: number) {
    const result = await utils.retrieve(
      Table.Evidence,
      ["evidenceID", "filename", "questionResponseID"],
      {
        column: "questionResponseID",
        value: id,
      }
    );
    return result;
  },

  async getResultEvidenceInfo(id: number) {
    const result = await utils.retrieve(
      Table.ResultEvidence,
      ["resultEvidenceID", "filename", "resultQuestionResponseID"],
      {
        column: "resultQuestionResponseID",
        value: id,
      }
    );
    return result;
  },

  async deleteAttachment(id: number) {
    //to remove file from file system as well
    const result = await utils.remove(Table.Attachment, {
      column: "attachmentID",
      value: id,
    });
    return result;
  },

  async deleteEvidence(id: number) {
    //to remove file from file system as well
    const result = await utils.remove(Table.Evidence, {
      column: "evidenceID",
      value: id,
    });
    return result;
  },

  async deleteResultEvidence(id: number) {
    //to remove file from file system as well
    const result = await utils.remove(Table.ResultEvidence, {
      column: "resultEvidenceID",
      value: id,
    });
    return result;
  },

  async getEvidence(id: number) {
    const result = await utils.retrieve(Table.Evidence, "*", {
      column: "questionResponseID",
      value: id,
    });
    return result as unknown as Attachment;
  },

  async getResultEvidence(id: number) {
    const result = await utils.retrieve(Table.ResultEvidence, "*", {
      column: "resultQuestionResponseID",
      value: id,
    });
    return result as unknown as Attachment;
  },

  async getAttachmentPath(id: number) {
    const result = await utils.retrieve(Table.Attachment, "filepath", {
      column: "announcementID",
      value: id,
    });
    return result as unknown as Attachment;
  },

  async getEvidencePath(id: number): Promise<FileFormat[]> {
    const results = await utils.retrieve(Table.Evidence, "filepath", {
      column: "questionResponseID",
      value: id,
    });
    return results as unknown as FileFormat[];
  },

  async getResultEvidencePath(id: number) {
    const result = await utils.retrieve(Table.ResultEvidence, "filepath", {
      column: "resultQuestionResponseID",
      value: id,
    });
    return result as unknown as ResultEvidence;
  },
  async getFormResponseIDs(formIDs: number[], groupID: number) {
    const query = `SELECT formResponseID FROM form_response WHERE formID IN (?) AND groupID = ? AND respectiveGroupID = ?`;
    const [result] = (await mysql.query(query, [
      formIDs,
      groupID,
      groupID,
    ])) as RowDataPacket[];
    const extractedformResponseIDs = result?.map(
      (item: { formResponseID: number }) => item.formResponseID
    );
    return extractedformResponseIDs as number[];
  },
  async getEnablerDirectory(questionResponseIDs: number[]) {
    const query = `SELECT qr.questionResponseID,
CONCAT(CONVERT(f.formNumber,char),".",CONVERT(c.criterionNumber,char),".",CONVERT(sc.subCriterionNumber,char),".",(CASE WHEN q.questionNumber = 0 THEN "Plan" WHEN q.questionNumber = 1 THEN "Do" ELSE "CQI" END)) AS "directory"
FROM form f
INNER JOIN criterion c ON f.formID = c.formID
INNER JOIN sub_criterion sc ON c.criterionID = sc.criterionID
INNER JOIN question q ON sc.subCriterionID = q.subCriterionID
INNER JOIN question_response qr ON q.questionID = qr.questionID AND qr.questionResponseID IN (?)`;
    const [result] = (await mysql.query(query, [questionResponseIDs])) as RowDataPacket[];
    return result;
  },
  async getResultDirectory(resultQuestionResponseIDs: number[]) {
    const query = `SELECT rqr.resultQuestionResponseID,
CONCAT(CONVERT(SUBSTRING(f.title, 1, 40),char),".",CONVERT(CEILING(rq.resultQuestionNumber/3),char),".",(CASE WHEN rq.resultQuestionNumber%3 = 1 THEN "Level" WHEN rq.resultQuestionNumber%3 = 2 THEN "Trend" ELSE "Comparison" END)) AS "directory"
FROM form f
INNER JOIN result_question rq ON f.formID = rq.formID
INNER JOIN result_question_response rqr ON rq.resultQuestionID = rqr.resultQuestionID AND rqr.resultQuestionResponseID IN (?)`;
    const [result] = (await mysql.query(query, [resultQuestionResponseIDs])) as RowDataPacket[];
    return result;
  },
  async getQuestionResponseIDs(formResponseIDs: number[]) {
    const result = await utils.retrieve(
      Table.QuestionResponse,
      "questionResponseID",
      {
        column: "formResponseID",
        value: formResponseIDs,
      }
    );
    const extractedQuestionResponseIDs = result?.map(
      (item: { questionResponseID: number }) => item.questionResponseID
    );
    return extractedQuestionResponseIDs as number[];
  },
  async getResultQuestionResponseIDs(formResponseIDs: number[]) {
    const result = await utils.retrieve(
      Table.ResultQuestionResponse,
      "resultQuestionResponseID",
      {
        column: "formResponseID",
        value: formResponseIDs,
      }
    );
    const extractedResultQuestionResponseIDs = result?.map(
      (item: { resultQuestionResponseID: number }) =>
        item.resultQuestionResponseID
    );
    return extractedResultQuestionResponseIDs as number[];
  },
};
