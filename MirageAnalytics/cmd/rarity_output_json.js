const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const Database = require('better-sqlite3');
const jsondata = require(appRoot + '/modules/jsondata.js');
const fs = require('fs');

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);
const outputPath = appRoot + '/config/collection-rarities.json';

fs.truncateSync(outputPath);

const logger = fs.createWriteStream(outputPath, {
  flags: 'a'
});

logger.write("[\n");

let totalcactusCount = db.prepare('SELECT COUNT(id) as cactus_total FROM cactus').get().cactus_total;
let cactus = db.prepare('SELECT cactus.* FROM cactus ORDER BY id').all();

let count = 0;
cactus.forEach(cactus => {
    console.log("Process cactus: #" + cactus.id);
    if ((count+1) == totalcactusCount) {
        logger.write(JSON.stringify(jsondata.cactus(cactus))+"\n");
    } else {
        logger.write(JSON.stringify(jsondata.cactus(cactus))+",\n");
    }
    count++
});

logger.write("]");

logger.end();