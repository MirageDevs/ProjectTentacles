const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const collectionData = require(appRoot + '/config/' + config.collection_file_name);
const fs = require('fs');
const Database = require('better-sqlite3');
const _ = require('lodash');
const argv = require('minimist')(process.argv.slice(2),{
    string: ['mode'],
});

let mode = argv['mode'];

const databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (mode != 'force') { 
    if (fs.existsSync(databasePath)) {
        console.log("Database exist.");
        return;
    }
}

fs.writeFileSync(databasePath, '', { flag: 'w' });
console.log("Database created.");

const db = new Database(databasePath);

let totalcactus = 0;
let traitTypeId = 0;
let traitDetailTypeId = 0;
let cactusTraitTypeId = 0;
let cactuscoreId = 0;

let traitTypeIdMap = {};
let traitTypeCount = {};
let traitDetailTypeIdMap = {};
let traitDetailTypeCount = {};
let cactusTraitTypeCount = {};

let ignoreTraits = config.ignore_traits.map(ignore_trait => ignore_trait.toLowerCase());

db.exec(
    "CREATE TABLE cactus (" +
        "id INT, " +
        "name TEXT, " +
        "description TEXT, " + 
        "image TEXT, " +
        "external_url TEXT, " +
        "animation_url TEXT " +
    ")"
);

db.exec(
    "CREATE TABLE trait_types (" +
        "id INT, " +
        "trait_type TEXT, " +
        "trait_data_type TEXT, " +
        "cactus_count INT " +
    ")"
);

db.exec(
    "CREATE TABLE trait_detail_types (" +
        "id INT, " +
        "trait_type_id INT, " +
        "trait_detail_type TEXT, " +
        "cactus_count INT " +
    ")"
);

db.exec(
    "CREATE TABLE cactus_traits (" +
        "id INT, " +
        "cactus_id INT, " +
        "trait_type_id INT, " + 
        "value TEXT " +
    ")"
);

db.exec(
    "CREATE TABLE cactus_trait_counts (" +
        "trait_count INT, " +
        "cactus_count INT " +
    ")"
);

let insertcactustmt = db.prepare("INSERT INTO cactus VALUES (?, ?, ?, ?, ?, ?)");
let insertTraitTypeStmt = db.prepare("INSERT INTO trait_types VALUES (?, ?, ?, ?)");
let insertTraitDetailTypeStmt = db.prepare("INSERT INTO trait_detail_types VALUES (?, ?, ?, ?)");
let insertPuntTraitStmt = db.prepare("INSERT INTO cactus_traits VALUES (?, ?, ?, ?)");

let count1 = config.collection_id_from;
collectionData.forEach(element => {

    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (element.id == undefined) {
        element['id'] = count1;
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count1;
    }
    if (_.isEmpty(element.name)) {
        element['name'] = config.collection_name + ' #' + element.id;
    }
    if (!element.name.includes('#'+element.id)) {
        element['name'] = element['name'] + ' #' + (count1 + config.collection_id_from);
    }
    if (_.isEmpty(element.description)) {
        element['description'] = '';
    }
    if (_.isEmpty(element.external_url)) {
        element['external_url'] = '';
    }
    if (_.isEmpty(element.animation_url)) {
        element['animation_url'] = '';
    }

    console.log("Prepare cactus: #" + element.id);
    
    insertcactustmt.run(element.id, element.name, element.description, element.image, element.external_url, element.animation_url);

    let thiscactusTraitTypes = [];

    if (_.isEmpty(element.attributes) && !_.isEmpty(element.traits)) {
        element.attributes = [];
        for (const [key, value] of Object.entries(element.traits)) {
            element.attributes.push(
                {
                    trait_type: key,
                    value: value
                }
            );
        }
    }

    // fake data for date
    /*
    element.attributes.push({
        value: '2456221590',
        trait_type: 'date',
        display_type: 'date',
    });
    */

    element.attributes.forEach(attribute => {

        if (attribute.value) {
            attribute.value = attribute.value.toString();
        }

        if (_.isEmpty(attribute.trait_type) || _.isEmpty(attribute.value) || attribute.value.toLowerCase() == 'none' || attribute.value.toLowerCase() == 'nothing' || attribute.value.toLowerCase() == '0') {
            return;
        }

        // Trait type
        if (!traitTypeCount.hasOwnProperty(attribute.trait_type)) {
            let traitDataType = 'string';
            if (!_.isEmpty(attribute.display_type) && attribute.display_type.toLowerCase() == 'date') {
                traitDataType = 'date';
            }
            insertTraitTypeStmt.run(traitTypeId, _.startCase(attribute.trait_type), traitDataType, 0);
            traitTypeIdMap[attribute.trait_type] = traitTypeId;
            traitTypeId = traitTypeId + 1;
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitTypeCount[attribute.trait_type] = 0 + 1;
            } else {
                traitTypeCount[attribute.trait_type] = 0;
            }
        } else {
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitTypeCount[attribute.trait_type] = traitTypeCount[attribute.trait_type] + 1;
            } else {
                traitTypeCount[attribute.trait_type] = 0;
            }
        }

        // Trait detail type
        if (!traitDetailTypeCount.hasOwnProperty(attribute.trait_type+'|||'+attribute.value)) {
            insertTraitDetailTypeStmt.run(traitDetailTypeId, traitTypeIdMap[attribute.trait_type], attribute.value, 0);
            traitDetailTypeIdMap[attribute.trait_type+'|||'+attribute.value] = traitDetailTypeId;
            traitDetailTypeId = traitDetailTypeId + 1;
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0 + 1;
            } else {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0;
            }
        } else {
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] + 1; 
            } else {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0;
            }  
        }

        insertPuntTraitStmt.run(cactusTraitTypeId, element.id, traitTypeIdMap[attribute.trait_type], attribute.value);  
        cactusTraitTypeId = cactusTraitTypeId + 1;
        
        if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
            thiscactusTraitTypes.push(attribute.trait_type);
        }
    });

    if (!cactusTraitTypeCount.hasOwnProperty(thiscactusTraitTypes.length)) {
        cactusTraitTypeCount[thiscactusTraitTypes.length] = 0 + 1;
    } else {
        cactusTraitTypeCount[thiscactusTraitTypes.length] = cactusTraitTypeCount[thiscactusTraitTypes.length] + 1;
    }

    totalcactus = totalcactus + 1;
    count1 = count1 + 1;
});

console.log(traitTypeCount);
let updateTraitTypeStmt = db.prepare("UPDATE trait_types SET cactus_count = :cactus_count WHERE id = :id");
for(let traitType in traitTypeCount)
{
    let thisTraitTypeCount = traitTypeCount[traitType];
    let traitTypeId = traitTypeIdMap[traitType];
    updateTraitTypeStmt.run({
        cactus_count: thisTraitTypeCount,
        id: traitTypeId
    });
}
console.log(traitDetailTypeCount);
let updateTraitDetailTypeStmt = db.prepare("UPDATE trait_detail_types SET cactus_count = :cactus_count WHERE id = :id");
for(let traitDetailType in traitDetailTypeCount)
{
    let thisTraitDetailTypeCount = traitDetailTypeCount[traitDetailType];
    let traitDetailTypeId = traitDetailTypeIdMap[traitDetailType];
    updateTraitDetailTypeStmt.run({
        cactus_count: thisTraitDetailTypeCount,
        id: traitDetailTypeId
    });
}
console.log(cactusTraitTypeCount);
let insertcactusTraitContStmt = db.prepare("INSERT INTO cactus_trait_counts VALUES (?, ?)");
for(let countType in cactusTraitTypeCount)
{
    let thisTypeCount = cactusTraitTypeCount[countType];
    insertcactusTraitContStmt.run(countType, thisTypeCount);
}

let createScoreTableStmt = "CREATE TABLE cactus_scores ( id INT, cactus_id INT, ";
let insertcactuscoreStmt = "INSERT INTO cactus_scores VALUES (:id, :cactus_id, ";

for (let i = 0; i < traitTypeId; i++) {
    createScoreTableStmt = createScoreTableStmt + "trait_type_" + i + "_percentile DOUBLE, trait_type_" + i + "_rarity DOUBLE, trait_type_" + i + "_value TEXT, ";
    insertcactuscoreStmt = insertcactuscoreStmt + ":trait_type_" + i + "_percentile, :trait_type_" + i + "_rarity, :trait_type_" + i + "_value, ";
}

createScoreTableStmt = createScoreTableStmt + "trait_count INT,  trait_count_percentile DOUBLE, trait_count_rarity DOUBLE, rarity_sum DOUBLE, rarity_rank INT)";
insertcactuscoreStmt = insertcactuscoreStmt + ":trait_count,  :trait_count_percentile, :trait_count_rarity, :rarity_sum, :rarity_rank)";

db.exec(createScoreTableStmt);
insertcactuscoreStmt = db.prepare(insertcactuscoreStmt);

let count2 = config.collection_id_from;
collectionData.forEach(element => {
    
    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count2;
    }

    console.log("Analyze cactus: #" + element.id);

    let thiscactusTraitTypes = [];
    let thiscactusDetailTraits = {};

    if (_.isEmpty(element.attributes) && !_.isEmpty(element.traits)) {
        element.attributes = [];
        for (const [key, value] of Object.entries(element.traits)) {
            element.attributes.push(
                {
                    trait_type: key,
                    value: value
                }
            );
        }
    }

    element.attributes.forEach(attribute => {

        if (attribute.value) {
            attribute.value = attribute.value.toString();
        }
        
        if (_.isEmpty(attribute.trait_type) || _.isEmpty(attribute.value) || attribute.value.toLowerCase() == 'none' || attribute.value.toLowerCase() == 'nothing' || attribute.value.toLowerCase() == '0') {
            return;
        }

        thiscactusTraitTypes.push(attribute.trait_type);
        thiscactusDetailTraits[attribute.trait_type] = attribute.value;
    });

    let cactuscore = {};
    let raritySum = 0;
    cactuscore['id'] = cactuscoreId;
    cactuscore['cactus_id'] = element.id;
    for(let traitType in traitTypeCount)
    {
        
        if (thiscactusTraitTypes.includes(traitType)) {
            // has trait
            let traitDetailType = thiscactusDetailTraits[traitType];
            let thisTraitDetailTypeCount = traitDetailTypeCount[traitType+'|||'+traitDetailType];
            let traitTypeId = traitTypeIdMap[traitType];
            if (!ignoreTraits.includes(traitType.toLowerCase())) {
                cactuscore['trait_type_' + traitTypeId + '_percentile'] = thisTraitDetailTypeCount/totalcactus;
                cactuscore['trait_type_' + traitTypeId + '_rarity'] = totalcactus/thisTraitDetailTypeCount;
                raritySum = raritySum + totalcactus/thisTraitDetailTypeCount;
            } else {
                cactuscore['trait_type_' + traitTypeId + '_percentile'] = 0;
                cactuscore['trait_type_' + traitTypeId + '_rarity'] = 0;
                raritySum = raritySum + 0;
            }
            cactuscore['trait_type_' + traitTypeId + '_value'] = traitDetailType;
        } else {   
            // missing trait
            let thisTraitTypeCount = traitTypeCount[traitType];
            let traitTypeId = traitTypeIdMap[traitType];
            if (!ignoreTraits.includes(traitType.toLowerCase())) {
                cactuscore['trait_type_' + traitTypeId + '_percentile'] = (totalcactus-thisTraitTypeCount)/totalcactus;
                cactuscore['trait_type_' + traitTypeId + '_rarity'] = totalcactus/(totalcactus-thisTraitTypeCount);
                raritySum = raritySum + totalcactus/(totalcactus-thisTraitTypeCount);
            } else {
                cactuscore['trait_type_' + traitTypeId + '_percentile'] = 0;
                cactuscore['trait_type_' + traitTypeId + '_rarity'] = 0;
                raritySum = raritySum + 0;
            }
            cactuscore['trait_type_' + traitTypeId + '_value'] = 'None';
        }
    }


    thiscactusTraitTypes = thiscactusTraitTypes.filter(thiscactusTraitType => !ignoreTraits.includes(thiscactusTraitType));
    let thiscactusTraitTypeCount = thiscactusTraitTypes.length;

    cactuscore['trait_count'] = thiscactusTraitTypeCount;
    cactuscore['trait_count_percentile'] = cactusTraitTypeCount[thiscactusTraitTypeCount]/totalcactus;
    cactuscore['trait_count_rarity'] = totalcactus/cactusTraitTypeCount[thiscactusTraitTypeCount];
    raritySum = raritySum + totalcactus/cactusTraitTypeCount[thiscactusTraitTypeCount];
    cactuscore['rarity_sum'] = raritySum;
    cactuscore['rarity_rank'] = 0;

    insertcactuscoreStmt.run(cactuscore);

    cactuscoreId = cactuscoreId + 1;
    count2 = count2 + 1;
});

const cactuscoreStmt = db.prepare('SELECT rarity_sum FROM cactus_scores WHERE cactus_id = ?');
const cactusRankStmt = db.prepare('SELECT COUNT(id) as higherRank FROM cactus_scores WHERE rarity_sum > ?');
let updatcactusRankStmt = db.prepare("UPDATE cactus_scores SET rarity_rank = :rarity_rank WHERE cactus_id = :cactus_id");

let count3 = config.collection_id_from;
collectionData.forEach(element => {
    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count3;
    }

    console.log("Ranking cactus: #" + element.id);
    let cactuscore = cactuscoreStmt.get(element.id);
    let cactusRank = cactusRankStmt.get(cactuscore.rarity_sum);
    updatcactusRankStmt.run({
        rarity_rank: cactusRank.higherRank+1,
        cactus_id: element.id
    });
    count3 = count3 + 1;
});