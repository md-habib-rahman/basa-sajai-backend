import { config } from './config/env.js';
import app from './app.js';

app.listen(config.port, () => {
  console.log(`✅ Backend server running on port ${config.port}`);
  console.log(`🔒 Better Auth listening at ${config.authUrl}/api/auth`);
});