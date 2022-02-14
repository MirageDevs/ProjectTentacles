const config = {
    app_name: 'Mirage Rarity',
    app_description: 'Mirage Rarity is tool to check the rarity of collections by Mirage team',
    collection_file_name: 'collection.json',
    collection_contract_address: '0x5537d90a4a2dc9d9b37bab49b490cf67d4c54e91',
    collection_name: '7888 Cactus',
    collection_description: '7888 Cactus collection',
    collection_id_from: 0,
    ignore_traits: ['date'], 
    sqlite_file_name: 'database.sqlite',
    ga: 'G-BW69Z04YTP',
    main_og_image: '',
    item_path_name: 'cactus',
    page_item_num: 60,
    content_image_is_video: false,
    content_image_frame: 'circle', // circle, rectangle
    use_wallet: false
};

module.exports = config;