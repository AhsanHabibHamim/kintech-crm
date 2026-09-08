import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';
import { s3Enabled, saveObject } from '../services/storage.js';

fs.mkdirSync(config.storage.localDir, { recursive: true });

const disk = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.storage.localDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const storage = {
  _handleFile(req, file, cb) {
    disk._handleFile(req, file, (err, info) => {
      if (err) return cb(err);
      if (!s3Enabled()) return cb(null, info);
      fs.readFile(info.path)
        .then((buf) => saveObject(info.filename, buf, file.mimetype))
        .then(() => cb(null, info))
        .catch((e) => {
          console.error('[storage] s3 save failed, local copy kept:', e.message);
          cb(null, info);
        });
    });
  },
  _removeFile(req, file, cb) {
    disk._removeFile(req, file, cb);
  },
};

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const uploadProof = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error('Only PNG, JPG, WEBP or GIF payment proofs are allowed.'));
    cb(null, true);
  },
});