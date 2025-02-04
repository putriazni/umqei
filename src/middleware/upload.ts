import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../../resources'));
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() +'_' +file.originalname);
    }
})

const upload = multer({ storage });

export default upload;
