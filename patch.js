const fs = require('fs');
const file = 'src/pages/AuthPage.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const isBadKey = \(status === 401 \|\| status === 403\) && !isCredentialError && \/jwt\|key\|api\|token\/i\.test\(raw\);/,
  "const isBadKey = (status === 401 || status === 403) && !isCredentialError && /key|api/i.test(raw) && !/jwt|token/i.test(raw);"
);

fs.writeFileSync(file, code);
