const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const Database = require('better-sqlite3');
const jsondata = require(appRoot + '/modules/jsondata.js');
const _ = require('lodash');
const MarkdownIt = require('markdown-it'),
    md = new MarkdownIt();

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);

/* GET cactus listing. */
router.get('/:id', function(req, res, next) {
  let cactusId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'cactus_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_cactus_scores';
  } else {
    useTraitNormalization = '0';
  }

  let cactus = db.prepare('SELECT cactus.*, '+scoreTable+'.rarity_rank FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) WHERE cactus.id = ?').get(cactusId);
  let cactuscore = db.prepare('SELECT '+scoreTable+'.* FROM '+scoreTable+' WHERE '+scoreTable+'.cactus_id = ?').get(cactusId);
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let allDetailTraitTypes = db.prepare('SELECT trait_detail_types.* FROM trait_detail_types').all();
  let allTraitCountTypes = db.prepare('SELECT cactus_trait_counts.* FROM cactus_trait_counts').all();

  let cactusTraits = db.prepare('SELECT cactus_traits.*, trait_types.trait_type  FROM cactus_traits INNER JOIN trait_types ON (cactus_traits.trait_type_id = trait_types.id) WHERE cactus_traits.cactus_id = ?').all(cactusId);
  let totalcactusCount = db.prepare('SELECT COUNT(id) as cactus_total FROM cactus').get().cactus_total;

  let cactusTraitData = {};
  let ignoredcactusTraitData = {};
  let ignoreTraits = config.ignore_traits.map(ignore_trait => ignore_trait.toLowerCase());
  cactusTraits.forEach(cactusTrait => {
    cactusTraitData[cactusTrait.trait_type_id] = cactusTrait.value;

    if (!ignoreTraits.includes(cactusTrait.trait_type.toLowerCase())) {
      ignoredcactusTraitData[cactusTrait.trait_type_id] = cactusTrait.value;
    }
  });

  let allDetailTraitTypesData = {};
  allDetailTraitTypes.forEach(detailTrait => {
    allDetailTraitTypesData[detailTrait.trait_type_id+'|||'+detailTrait.trait_detail_type] = detailTrait.cactus_count;
  });

  let allTraitCountTypesData = {};
  allTraitCountTypes.forEach(traitCount => {
    allTraitCountTypesData[traitCount.trait_count] = traitCount.cactus_count;
  });

  let title = config.collection_name + ' | ' + config.app_name;
  //let description = config.collection_description + ' | ' + config.app_description
  let description = cactus ? `💎 ID: ${ cactus.id }
    💎 Rarity Rank: ${ cactus.rarity_rank }
    💎 Rarity Score: ${ cactuscore.rarity_sum.toFixed(2) }` : '';

  if (!_.isEmpty(cactus)) {
    title = cactus.name + ' | ' + config.app_name;
  }
  
  res.render('cactus', { 
    appTitle: title,
    appDescription: description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: cactus ? cactus.image.replace('ipfs://', 'https://ipfs.io/ipfs/'): config.main_og_image,
    activeTab: 'rarity',
    cactus: cactus, 
    cactuscore: cactuscore, 
    allTraitTypes: allTraitTypes, 
    allDetailTraitTypesData: allDetailTraitTypesData, 
    allTraitCountTypesData: allTraitCountTypesData, 
    cactusTraitData: cactusTraitData, 
    ignoredcactusTraitData: ignoredcactusTraitData,
    totalcactusCount: totalcactusCount, 
    trait_normalization: useTraitNormalization,
    _: _,
    md: md
  });
});

router.get('/:id/json', function(req, res, next) {
  let cactusId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'cactus_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_cactus_scores';
  } else {
    useTraitNormalization = '0';
  }

  let cactus = db.prepare('SELECT cactus.*, '+scoreTable+'.rarity_rank FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) WHERE cactus.id = ?').get(cactusId);
  
  if (_.isEmpty(cactus)) {
    res.end(JSON.stringify({
      status: 'fail',
      message: 'not_exist',
    }));
  }

  let cactusData = jsondata.cactus(cactus, scoreTable);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'success',
    message: 'success',
    cactus: cactusData
  }));
});

router.get('/:id/similar', function(req, res, next) {
  let cactusId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'cactus_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_cactus_scores';
  } else {
    useTraitNormalization = '0';
  }

  let cactus = db.prepare('SELECT cactus.*, '+scoreTable+'.rarity_rank FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) WHERE cactus.id = ?').get(cactusId);
  let cactuscore = db.prepare('SELECT '+scoreTable+'.* FROM '+scoreTable+' WHERE '+scoreTable+'.cactus_id = ?').get(cactusId);
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let similarCondition = '';
  let similarTo = {};
  let similarcactus = null;
  if (cactuscore) {
    allTraitTypes.forEach(traitType => {
      similarCondition = similarCondition + 'IIF('+scoreTable+'.trait_type_'+traitType.id+'_value = :trait_type_'+traitType.id+', 1 * '+scoreTable+'.trait_type_'+traitType.id+'_rarity, 0) + ';
      similarTo['trait_type_'+traitType.id] = cactuscore['trait_type_'+traitType.id+'_value'];
    });
    similarTo['trait_count'] = cactuscore['trait_count'];
    similarTo['this_cactus_id'] = cactusId;
    similarcactus = db.prepare(`
      SELECT
        cactus.*,
        `+scoreTable+`.cactus_id, 
        (
          ` 
          + similarCondition +
          `
          IIF(`+scoreTable+`.trait_count = :trait_count, 1 * 0, 0)
        )
        similar 
      FROM `+scoreTable+`  
      INNER JOIN cactus ON (`+scoreTable+`.cactus_id = cactus.id)
      WHERE `+scoreTable+`.cactus_id != :this_cactus_id
      ORDER BY similar desc
      LIMIT 12
      `).all(similarTo);
  }

  
  let title = config.collection_name + ' | ' + config.app_name;
  let description = config.collection_description + ' | ' + config.app_description
  if (!_.isEmpty(cactus)) {
    title = cactus.name + ' | ' + config.app_name;
  }

  res.render('similar_cactus', { 
    appTitle: title,
    appDescription: description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: cactus ? cactus.image.replace('ipfs://', 'https://ipfs.io/ipfs/'): config.main_og_image,
    activeTab: 'rarity',
    cactus: cactus,
    similarcactus: similarcactus,
    trait_normalization: useTraitNormalization,
    _: _
  });
});

module.exports = router;
