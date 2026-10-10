import serverless from "serverless-http";
import app from "../../api/index";

export const handler = serverless(app, {
  binary: [
    'audio/*',
    'audio/mpeg',
    'audio/wav',
    'image/*',
    'image/png',
    'image/jpeg',
    'application/octet-stream'
  ]
});
