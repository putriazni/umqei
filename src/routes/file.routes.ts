import express from 'express';
import upload from '../middleware/upload';
import { download, getFiles, uploadFile, zipDownloadEvidence } from '../controllers/file.controller';

const router = express.Router();

router.post('/upload', upload.single('file'), uploadFile);
router.route('/files').get(getFiles);
router.route('/files/:filename').get(download);
router.route('/files/:filename/:download').get(download);
router.route('/files/:fileType/:parentID/:id').get(download);
router.route('/files/:fileType/:parentID/:id/:sendfile').get(download);
router.route('/evidence/:ptj/:yearSession').get(zipDownloadEvidence);

export default router;