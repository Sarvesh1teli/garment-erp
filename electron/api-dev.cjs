const path = require('node:path');
const { startLocalApi } = require('./local-api.cjs');

const dataDirectory = process.env.THREADFLOW_DATA_DIR || path.join(process.cwd(), '.local-data');
const port = Number(process.env.THREADFLOW_API_PORT || 47831);
startLocalApi({ dataDirectory, port })
  .then(({ port }) => console.log(`ThreadFlow local API listening on http://127.0.0.1:${port}`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
