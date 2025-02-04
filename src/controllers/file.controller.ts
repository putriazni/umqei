import { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { FileService } from "../services/fileService";
import { Table } from "../constants/global";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";
import { FormService } from "../services/formService";
import archiver from "archiver";

dotenv.config();
const config = {
  serverRootURL: "/api/files/",
  fileSystemDirectory: process.env.UPLOADS_DIRECTORY,
};

const upload = multer();

export async function uploadFile(req: Request, res: Response) {
  try {
    const uploadMiddleware = upload.single("file");

    uploadMiddleware(req, res, () => {
      if (!req.file) {
        const error = { message: "File not uploaded" };
        logHelper(
          `POST ${req.originalUrl}`,
          "uploadFile",
          AccessLayer.Controllers,
          error,
          true
        );
        return res.status(400).json(error);
      }

      const actualFilename = req.file.originalname;
      const fileType = req.file.mimetype;
      const fileSize = req.file.size;
      const windowsPath = req.file.path.split("resources\\")[1];
      const unixPath = req.file.path.split("resources/")[1];
      logHelper(
        `POST ${req.originalUrl}`,
        "uploadFile",
        AccessLayer.Controllers
      );
      return res.status(200).json({
        filename: actualFilename,
        mimeType: fileType,
        size: fileSize,
        path: unixPath || windowsPath,
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
    logHelper(
      `POST ${req.originalUrl}`,
      "uploadFile",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export const getFiles = (req: Request, res: Response) => {
  //Not in used & not up-to-date, if needed, update everything
  const directoryPath = config.fileSystemDirectory + "/resources";
  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      res.status(500).send({
        message: "Unable to scan files!",
      });
      logHelper(
        `GET ${req.originalUrl}`,
        "getFiles",
        AccessLayer.Controllers,
        err,
        true
      );
    }

    const fileInfos: any[] = [];

    files.forEach((file) => {
      fileInfos.push({
        name: file,
        url: config.serverRootURL + file,
      });
    });

    res.status(200).send(fileInfos);
    logHelper(`GET ${req.originalUrl}`, "getFiles", AccessLayer.Controllers);
  });
};

export const download = async (req: Request, res: Response) => {
  const fileID = Number(req.params.id);
  const fileType = req.params.fileType;
  const sendfile = req.params.sendfile === "true";
  const rootPath = config.fileSystemDirectory + "/resources/";
  const directoryPath = rootPath + fileType + "/" + req.params.parentID + "/";
  const table =
    fileType === "attachment"
      ? Table.Attachment
      : fileType === "evidence"
      ? Table.Evidence
      : fileType === "result_evidence"
      ? Table.ResultEvidence
      : undefined;
  const idName =
    fileType?.replace(/_(.)/g, (match, group1) => group1.toUpperCase()) + "ID";
  const outsideFileName = req.params.filename;
  const outsideFileDownload = req.params.download === "true";
  if (!table && !outsideFileName) {
    res.status(400).send({
      message: "Invalid file type",
    });
    return;
  }
  let namePath,
    filepath,
    filename,
    fullpath = directoryPath;
  if (table) {
    namePath = await FileService.getFilePath(fileID, table, idName);
    filepath = namePath.filepath;
    filename = namePath.filename;
    fullpath += filepath;
  }
  if (outsideFileName) {
    const path = rootPath + outsideFileName;
    if (!outsideFileDownload) {
      res.sendFile(path, (err) => {
        if (err) {
          res.status(500).send({
            message:
              "Could not send the file. " +
              err.message.replace(
                /[A-Z]:\\.+\\([^\\]+)/,
                "{censored file directory}"
              ),
          });
          logHelper(
            `GET ${req.originalUrl}`,
            "download",
            AccessLayer.Controllers,
            err,
            true
          );
        } else {
          logHelper(
            `GET ${req.originalUrl}`,
            "download",
            AccessLayer.Controllers
          );
        }
      });
      return;
    } else {
      res.download(path, outsideFileName, (err) => {
        if (err) {
          res.status(500).send({
            message:
              "Could not download the file. " +
              err.message.replace(
                /[A-Z]:\\.+\\([^\\]+)/,
                "{censored file directory}"
              ),
          });
          logHelper(
            `GET ${req.originalUrl}`,
            "download",
            AccessLayer.Controllers,
            err,
            true
          );
        } else {
          logHelper(
            `GET ${req.originalUrl}`,
            "download",
            AccessLayer.Controllers
          );
        }
      });
      return;
    }
  } else if (sendfile) {
    res.sendFile(fullpath, (err) => {
      if (err) {
        res.status(500).send({
          message:
            "Could not send the file. " +
            err.message.replace(
              /[A-Z]:\\.+\\([^\\]+)/,
              "{censored file directory}"
            ),
        });
        logHelper(
          `GET ${req.originalUrl}`,
          "download",
          AccessLayer.Controllers,
          err,
          true
        );
      } else {
        logHelper(
          `GET ${req.originalUrl}`,
          "download",
          AccessLayer.Controllers
        );
      }
    });
    return;
  } else {
    res.download(fullpath, filename, (err) => {
      if (err) {
        res.status(500).send({
          message:
            "Could not download the file. " +
            err.message.replace(
              /[A-Z]:\\.+\\([^\\]+)/,
              "{censored file directory}"
            ),
        });
        logHelper(
          `GET ${req.originalUrl}`,
          "download",
          AccessLayer.Controllers,
          err,
          true
        );
      } else {
        logHelper(
          `GET ${req.originalUrl}`,
          "download",
          AccessLayer.Controllers
        );
      }
    });
  }
};

export const zipDownloadEvidence = async (req: Request, res: Response) => {
  try{
  const yearSession = String(req.params.yearSession);
  const ptj = Number(req.params.ptj);
  const formIDs = await FormService.getYearSessionForm(yearSession);
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });
  if (Array.isArray(formIDs) && formIDs.length > 0) {
    const formResponseIDs = await FileService.getFormResponseIDs(formIDs, ptj);
    if (Array.isArray(formResponseIDs) && formResponseIDs.length > 0) {
      const questionResponseIDs = await FileService.getQuestionResponseIDs(formResponseIDs);
      const resultQuestionResponseIDs = await FileService.getResultQuestionResponseIDs(formResponseIDs);
      const enablerDirectory = await FileService.getEnablerDirectory(questionResponseIDs);
      const resultDirectory = await FileService.getResultDirectory(resultQuestionResponseIDs);
      if (
        Array.isArray(enablerDirectory) &&
        enablerDirectory.length > 0
      ) {
        const evidencePath =
          config.fileSystemDirectory + "/resources/evidence/";
        for (const enabler of enablerDirectory) {
          if (fs.existsSync(evidencePath + enabler.questionResponseID)) {
            archive.directory(evidencePath + enabler.questionResponseID, "enablers/" + enabler.directory);
          }
        }
      }
      if (
        Array.isArray(resultDirectory) &&
        resultDirectory.length > 0
      ) {
        const resultEvidencePath =
          config.fileSystemDirectory + "/resources/result_evidence/";
        for (const result of resultDirectory) {
          if (fs.existsSync(resultEvidencePath + result.resultQuestionResponseID)) {
            archive.directory(resultEvidencePath + result.resultQuestionResponseID, "results/" + result.directory);
          }
        }
      }
    }
  }
  res.attachment("evidence.zip").type("zip");
  archive.pipe(res);
  archive.finalize();
}
catch(error){
  res.status(500).json({ message: "Internal Server Error" });
  logHelper(
    `GET ${req.originalUrl}`,
    "zipDownloadEvidence",
    AccessLayer.Controllers,
    error,
    true
  );
}
};
