import express from 'express';
import {authRouter} from './routes/auth-routes.js';
const app = express();
const port = Number(process.env.PORT ?? 3000);
app.use(express.json({limit:'100kb'}));
app.get('/health', (_request, response) => {
  response.json({status:'ok', service:'library-flow-api'});
});
app.use('/api/v1/auth', authRouter);
app.listen(port, () => {
  console.log(`LibraryFlow API listening on port ${port}`);
});
