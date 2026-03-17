const fs = require('fs');
const file = '/www/CodeSpace/Veloxis/worker/src/simulate-user.ts';
let code = fs.readFileSync(file, 'utf8');

// The worker connects to directus directly on port 8055 inside docker, 
// so the URL doesn't have the NGINX prefix (/hdjskefs45).
// Or we need to use the gateway port 8080.
// Let's use the local gateway for the simulation.
code = code.replace("config.directus.url", "`http://veloxis_gateway:80/hdjskefs45`");
// wait, inside container it can't resolve veloxis_gateway:80. Let's use internal service name `directus:8055`. Wait, directus doesn't know about /hdjskefs45 natively unless configured.
// It's configured via PUBLIC_URL. Let's try directus:8055 directly without the prefix for API calls.

fs.writeFileSync(file, code);
