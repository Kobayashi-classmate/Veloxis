const fs = require('fs');
let compose = fs.readFileSync('/www/CodeSpace/Veloxis/docker-compose.yml', 'utf8');

const s3Config = {
  identities: [
    {
      name: "admin",
      credentials: [
        {
          accessKey: "dcd_admin_key",
          secretKey: "dcd_super_secret_key_2026"
        }
      ],
      actions: ["Read", "Write", "List", "Tagging", "Admin"]
    }
  ]
};

const s3ConfigStr = JSON.stringify(s3Config).replace(/"/g, '\\"');

compose = compose.replace(/seaweedfs:[\s\S]*?command: "server -dir=\/data -s3"/, 
`seaweedfs:
    image: chrislusf/seaweedfs:latest
    container_name: veloxis_seaweedfs
    command: "server -dir=/data -s3"
    environment:
      - WEED_S3_CONFIG=${s3ConfigStr}`);

fs.writeFileSync('/www/CodeSpace/Veloxis/docker-compose.yml', compose);
