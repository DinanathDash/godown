import app from './app';
import { env } from './config/env';

const startServer = () => {
  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
};

startServer();
