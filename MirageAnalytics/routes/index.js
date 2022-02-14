const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const request = require('sync-request');
const express = require('express');
const router = express.Router();
const Web3 = require('web3');
const fs = require('fs');
const Database = require('better-sqlite3');
const _ = require('lodash');

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);

/* GET home page. */
router.get('/', function(req, res, next) {

  let search = req.query.search;
  let traits = req.query.traits;
  let useTraitNormalization = req.query.trait_normalization;
  let orderBy = req.query.order_by;
  let page = req.query.page;

  let offset = 0;
  let limit = config.page_item_num;

  if (_.isEmpty(search)) {
    search = '';
  }

  if (_.isEmpty(traits)) {
    traits = '';
  }

  let scoreTable = 'cactus_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_cactus_scores';
  } else {
    useTraitNormalization = '0';
  }

  if (orderBy == 'rarity' || orderBy == 'id') {
    orderBy = orderBy;
  } else {
    orderBy = 'rarity';
  }

  if (!_.isEmpty(page)) {
    page = parseInt(page);
    if (!isNaN(page)) {
      offset = (Math.abs(page) - 1) * limit;
    } else {
      page = 1;
    }
  } else {
    page = 1;
  }

  let selectedTraits = (traits != '') ? traits.split(',') : [];
  let totalcactusCount = 0
  let cactus = null;
  let orderByStmt = '';
  if (orderBy == 'rarity') {
    orderByStmt = 'ORDER BY '+scoreTable+'.rarity_rank ASC';
  } else {
    orderByStmt = 'ORDER BY cactus.id ASC';
  }

  let totalSupply = db.prepare('SELECT COUNT(cactus.id) as cactus_total FROM cactus').get().cactus_total;
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let allTraitTypesData = {};
  allTraitTypes.forEach(traitType => {
    allTraitTypesData[traitType.trait_type] = traitType.cactus_count;
  });

  let allTraits = db.prepare('SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.cactus_count, trait_detail_types.trait_type_id, trait_detail_types.id trait_detail_type_id  FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.cactus_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type').all();
  let totalcactusCountQuery = 'SELECT COUNT(cactus.id) as cactus_total FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) ';
  let cactusQuery = 'SELECT cactus.*, '+scoreTable+'.rarity_rank FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) ';
  let totalcactusCountQueryValue = {};
  let cactusQueryValue = {};

  if (!_.isEmpty(search)) {
    search = parseInt(search);
    totalcactusCountQuery = totalcactusCountQuery+' WHERE cactus.id LIKE :cactus_id ';
    totalcactusCountQueryValue['cactus_id'] = '%'+search+'%';

    cactusQuery = cactusQuery+' WHERE cactus.id LIKE :cactus_id ';
    cactusQueryValue['cactus_id'] = '%'+search+'%';
  } else {
    totalcactusCount = totalcactusCount;
  }

  let allTraitTypeIds = [];
  allTraits.forEach(trait => {
    if (!allTraitTypeIds.includes(trait.trait_type_id.toString())) {
      allTraitTypeIds.push(trait.trait_type_id.toString());
    }
  }); 

  let purifySelectedTraits = [];
  if (selectedTraits.length > 0) {

    selectedTraits.map(selectedTrait => {
      selectedTrait = selectedTrait.split('_');
      if ( allTraitTypeIds.includes(selectedTrait[0]) ) {
        purifySelectedTraits.push(selectedTrait[0]+'_'+selectedTrait[1]);
      }
    });

    if (purifySelectedTraits.length > 0) {
      if (!_.isEmpty(search.toString())) {
        totalcactusCountQuery = totalcactusCountQuery + ' AND ';
        cactusQuery = cactusQuery + ' AND ';
      } else {
        totalcactusCountQuery = totalcactusCountQuery + ' WHERE ';
        cactusQuery = cactusQuery + ' WHERE ';
      }
      let count = 0;

      purifySelectedTraits.forEach(selectedTrait => {
        selectedTrait = selectedTrait.split('_');
        totalcactusCountQuery = totalcactusCountQuery+' '+scoreTable+'.trait_type_'+selectedTrait[0]+'_value = :trait_type_'+selectedTrait[0]+'_value ';
        cactusQuery = cactusQuery+' '+scoreTable+'.trait_type_'+selectedTrait[0]+'_value = :trait_type_'+selectedTrait[0]+'_value ';
        if (count != (purifySelectedTraits.length-1)) {
          totalcactusCountQuery = totalcactusCountQuery + ' AND ';
          cactusQuery = cactusQuery + ' AND ';
        }
        count++;

        totalcactusCountQueryValue['trait_type_'+selectedTrait[0]+'_value'] = selectedTrait[1];
        cactusQueryValue['trait_type_'+selectedTrait[0]+'_value'] = selectedTrait[1];    
      });
    }
  }
  let purifyTraits = purifySelectedTraits.join(',');

  cactusQuery = cactusQuery+' '+orderByStmt+' LIMIT :offset,:limit';
  cactusQueryValue['offset'] = offset;
  cactusQueryValue['limit'] = limit;

  totalcactusCount = db.prepare(totalcactusCountQuery).get(totalcactusCountQueryValue).cactus_total;
  cactus = db.prepare(cactusQuery).all(cactusQueryValue);

  let totalPage =  Math.ceil(totalcactusCount/limit);

  res.render('index', { 
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'rarity',
    cactus: cactus, 
    totalcactusCount: totalcactusCount,
    totalPage: totalPage, 
    search: search, 
    useTraitNormalization: useTraitNormalization,
    orderBy: orderBy,
    traits: purifyTraits,
    selectedTraits: purifySelectedTraits,
    allTraits: allTraits,
    page: page,
    totalSupply: totalSupply,
    allTraitTypesData: allTraitTypesData,
    _:_ 
  });
});

router.get('/matrix', function(req, res, next) {

  let allTraits = db.prepare('SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.cactus_count FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.cactus_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type').all();
  let allTraitCounts = db.prepare('SELECT * FROM cactus_trait_counts WHERE cactus_count != 0 ORDER BY trait_count').all();
  let totalcactusCount = db.prepare('SELECT COUNT(id) as cactus_total FROM cactus').get().cactus_total;

  res.render('matrix', {
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'matrix',
    allTraits: allTraits,
    allTraitCounts: allTraitCounts,
    totalcactusCount: totalcactusCount,
    _:_ 
  });
});

router.get('/wallet', function(req, res, next) {
  let search = req.query.search;
  let useTraitNormalization = req.query.trait_normalization;

  if (_.isEmpty(search)) {
    search = '';
  }

  let scoreTable = 'cactus_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_cactus_scores';
  } else {
    useTraitNormalization = '0';
  }

  let isAddress = Web3.utils.isAddress(search);
  let tokenIds = [];
  let cactus = null;
  if (isAddress) {
    let url = 'https://api.cactuscape.xyz/address/'+search+'/cactuscapes';
    let result = request('GET', url);
    let data = result.getBody('utf8');
    data = JSON.parse(data);
    data.forEach(element => {
      tokenIds.push(element.token_id);
    });
    if (tokenIds.length > 0) {
      let cactusQuery = 'SELECT cactus.*, '+scoreTable+'.rarity_rank FROM cactus INNER JOIN '+scoreTable+' ON (cactus.id = '+scoreTable+'.cactus_id) WHERE cactus.id IN ('+tokenIds.join(',')+') ORDER BY '+scoreTable+'.rarity_rank ASC';
      cactus = db.prepare(cactusQuery).all();
    }
  }

  res.render('wallet', {
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'wallet',
    cactus: cactus,
    search: search, 
    useTraitNormalization: useTraitNormalization,
    _:_ 
  });
});

module.exports = router;
