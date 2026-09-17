const path = require('path');
try { require('dotenv').config({ path: path.join(process.cwd(), '.env') }); } catch {}
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch {}
const { startLocalApi } = require('./local-api.cjs');

const dataDirectory = process.env.THREADFLOW_DATA_DIR || path.join(process.cwd(), '.local-data');
const port = Number(process.env.PORT || process.env.THREADFLOW_API_PORT || 47831);
startLocalApi({ dataDirectory, port })
  .then(({ port }) => console.log(`ThreadFlow local API listening on http://0.0.0.0:${port}`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
