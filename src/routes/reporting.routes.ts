import { Router } from "express";
import { getReportList, getPTjSessionInfo } from "../controllers/reporting.controller";
const router = Router();

router.route('/list/:groupID/:userID').get(getReportList);
router.route('/ptjSessionInfo/:groupID/:session').get(getPTjSessionInfo);

export default router;