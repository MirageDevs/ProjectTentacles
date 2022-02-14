const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const fs = require('fs');
const Database = require('better-sqlite3');
const argv = require('minimist')(process.argv.slice(2),{
    string: ['mode'],
});

let mode = argv['mode'];

let ignoreTraits = config.ignore_traits.map(ignore_trait => ignore_trait.toLowerCase());

const databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
    console.log("Database not exist.");
    return;
}

const db = new Database(databasePath);

if (mode != 'force') {
    let checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='normalized_cactus_scores'").get();
    if (checkTable) {
        if (checkTable.name == 'normalized_cactus_scores') {
            console.log("Database exist.");
            return;
        }
    }
}

let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
let allTraitTypeCount = db.prepare('SELECT trait_type_id, COUNT(trait_type_id) as trait_type_count, SUM(cactus_count) trait_type_sum FROM trait_detail_types GROUP BY trait_type_id').all();
let traitCountNum = db.prepare('SELECT COUNT(*) as trait_count_num FROM cactus_trait_counts').get().trait_count_num;
let traitCounts = db.prepare('SELECT * FROM cactus_trait_counts').all();
let totalSupply = db.prepare('SELECT COUNT(cactus.id) as cactus_total FROM cactus').get().cactus_total;
let allTraits = db.prepare('SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.cactus_count, trait_detail_types.trait_type_id, trait_detail_types.id trait_detail_type_id  FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type').all();

let traitTypeCountSum = 0 + traitCountNum;
let traitTypeNum = 0 + 1;
let missingTraitTypeId = [];
let traitTypeRarityScoreSum = [];
let traitTypeCountNum = [];
let traitTypeValueCount = [];
allTraitTypeCount.forEach(traitTypeCount => {

    let thisTraitType = db.prepare('SELECT trait_types.* FROM trait_types WHERE id = ?').get(traitTypeCount.trait_type_id);
    if (ignoreTraits.includes(thisTraitType.trait_type.toLowerCase())) {
        traitTypeRarityScoreSum[traitTypeCount.trait_type_id] = 0;
        traitTypeCountNum[traitTypeCount.trait_type_id] = 0;
        traitTypeValueCount[traitTypeCount.trait_type_id] = 0;
    } else {
        let hasMissingTrait = (traitTypeCount.trait_type_sum != totalSupply) ? 1 : 0;
        if (hasMissingTrait) {
            missingTraitTypeId.push(traitTypeCount.trait_type_id);
            traitTypeRarityScoreSum[traitTypeCount.trait_type_id] = totalSupply/(totalSupply-traitTypeCount.trait_type_sum);
        } else {
            traitTypeRarityScoreSum[traitTypeCount.trait_type_id] = 0;    
        }
        traitTypeCountNum[traitTypeCount.trait_type_id] = traitTypeCount.trait_type_count + hasMissingTrait;
        traitTypeCountSum = traitTypeCountSum + (traitTypeCount.trait_type_count + hasMissingTrait);
        traitTypeNum = traitTypeNum + 1;

        traitTypeValueCount[traitTypeCount.trait_type_id] = traitTypeCount.trait_type_count + hasMissingTrait;
    }
});
traitTypeValueCount[allTraitTypes.length] = traitCountNum;
let meanValueCount = traitTypeCountSum/traitTypeNum;

allTraits.forEach(detailTrait => {
    traitTypeRarityScoreSum[detailTrait.trait_type_id] = traitTypeRarityScoreSum[detailTrait.trait_type_id] +
        totalSupply/detailTrait.cactus_count;
});
traitTypeRarityScoreSum[allTraitTypes.length] = 0;
traitCounts.forEach(traitCount => {
    traitTypeRarityScoreSum[allTraitTypes.length] = traitTypeRarityScoreSum[allTraitTypes.length] + 
        totalSupply/traitCount.cactus_count;
}); 

let traitTypeMeanRarity = [];
allTraitTypes.forEach(traitType => {
    if (ignoreTraits.includes(traitType.trait_type.toLowerCase())) {
        traitTypeMeanRarity[traitType.id] = 0;
    } else {
        traitTypeMeanRarity[traitType.id] = traitTypeRarityScoreSum[traitType.id]/traitTypeCountNum[traitType.id];
    }
});
traitTypeMeanRarity[allTraitTypes.length] = traitTypeRarityScoreSum[allTraitTypes.length]/traitCountNum;
let meanRarity = traitTypeMeanRarity.reduce((a,b) => a + b, 0) / traitTypeMeanRarity.length;

console.log(traitTypeValueCount);
console.log(meanValueCount);
console.log(traitTypeMeanRarity);
console.log(meanRarity);

let createScoreTableStmt = "CREATE TABLE normalized_cactus_scores ( id INT, cactus_id INT, ";
let insertcactuscoreStmt = "INSERT INTO normalized_cactus_scores VALUES (:id, :cactus_id, ";

allTraitTypes.forEach(traitType => {
    createScoreTableStmt = createScoreTableStmt + "trait_type_" + traitType.id + "_percentile DOUBLE, trait_type_" + traitType.id + "_rarity DOUBLE, trait_type_" + traitType.id + "_value TEXT, ";
    insertcactuscoreStmt = insertcactuscoreStmt + ":trait_type_" + traitType.id + "_percentile, :trait_type_" + traitType.id + "_rarity, :trait_type_" + traitType.id + "_value, ";
});

createScoreTableStmt = createScoreTableStmt + "trait_count INT,  trait_count_percentile DOUBLE, trait_count_rarity DOUBLE, rarity_sum DOUBLE, rarity_rank INT)";
insertcactuscoreStmt = insertcactuscoreStmt + ":trait_count,  :trait_count_percentile, :trait_count_rarity, :rarity_sum, :rarity_rank)";

db.exec(createScoreTableStmt);
insertcactuscoreStmt = db.prepare(insertcactuscoreStmt);

let cactuscores = db.prepare('SELECT * FROM cactus_scores').all();

cactuscores.forEach(cactuscore => {

    console.log("Normalize cactus: #" + cactuscore.id);

    let raritySum = 0;
    let normalizedcactuscore = {};
    normalizedcactuscore['id'] = cactuscore.id;
    normalizedcactuscore['cactus_id'] = cactuscore.cactus_id;
    
    for (let i = 0; i < traitTypeMeanRarity.length; i++) {
        let a = 0;
        if (traitTypeMeanRarity[i] >= meanRarity) {
            a = (traitTypeMeanRarity[i] - meanRarity) / traitTypeMeanRarity[i];
        } else {
            a = (meanRarity - traitTypeMeanRarity[i]) / meanRarity;
        }

        let b = 0;
        if (traitTypeValueCount[i] >= meanValueCount) {
            b = (traitTypeValueCount[i] - meanValueCount) / traitTypeValueCount[i];
        } else {
            b = (meanValueCount - traitTypeValueCount[i]) / meanValueCount;
        }

        let c = traitTypeValueCount[i] >= meanValueCount ? 1 - b : 1 + b;
        let r = (i == traitTypeMeanRarity.length - 1) ? cactuscore['trait_count_rarity'] : cactuscore['trait_type_' + i + '_rarity'];
        let rarity_score_normalized = 0;

        if (a >= b && ((traitTypeMeanRarity[i] > meanRarity && traitTypeValueCount[i] > meanValueCount) || (traitTypeMeanRarity[i] < meanRarity && traitTypeValueCount[i] < meanValueCount))) {
          rarity_score_normalized = (r - (a - b) * r) * c + (a - b) * r;
        } else {
          rarity_score_normalized = (r - a * r) * c + a * r;
        }

        //console.log(i);
        //console.log(r);
        //console.log(rarity_score_normalized);

        if ((i == traitTypeMeanRarity.length - 1)) {
            normalizedcactuscore['trait_count'] = cactuscore['trait_count'];
            normalizedcactuscore['trait_count_percentile'] = cactuscore['trait_count_percentile'];
            normalizedcactuscore['trait_count_rarity'] = rarity_score_normalized;
            raritySum = raritySum + rarity_score_normalized;
            normalizedcactuscore['rarity_sum'] = raritySum;
            normalizedcactuscore['rarity_rank'] = 0;
        } else {
            if (!ignoreTraits.includes(cactuscore['trait_type_' + i + '_value'].toLowerCase())) {
                normalizedcactuscore['trait_type_' + i + '_percentile'] = cactuscore['trait_type_' + i + '_percentile'];
                normalizedcactuscore['trait_type_' + i + '_rarity'] = rarity_score_normalized;
                raritySum = raritySum + rarity_score_normalized;
            } else {
                normalizedcactuscore['trait_type_' + i + '_percentile'] = 0;
                normalizedcactuscore['trait_type_' + i + '_rarity'] = 0;
                raritySum = raritySum + 0;
            }
            normalizedcactuscore['trait_type_' + i + '_value'] = cactuscore['trait_type_' + i + '_value'];
        }
    }

    //console.log(normalizedcactuscore);

    insertcactuscoreStmt.run(normalizedcactuscore);
});

const cactuscoreStmt = db.prepare('SELECT rarity_sum FROM normalized_cactus_scores WHERE cactus_id = ?');
const cactusRankStmt = db.prepare('SELECT COUNT(id) as higherRank FROM normalized_cactus_scores WHERE rarity_sum > ?');
let updatcactusRankStmt = db.prepare("UPDATE normalized_cactus_scores SET rarity_rank = :rarity_rank WHERE cactus_id = :cactus_id");

cactuscores.forEach(cactuscore => {
    console.log("Normalized ranking cactus: #" + cactuscore.cactus_id);
    let normalizedcactuscore = cactuscoreStmt.get(cactuscore.cactus_id);
    let cactusRank = cactusRankStmt.get(normalizedcactuscore.rarity_sum);
    updatcactusRankStmt.run({
        rarity_rank: cactusRank.higherRank+1,
        cactus_id: cactuscore.cactus_id
    });
});