// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts@4.4.1/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.4.1/access/Ownable.sol";

contract NFTTest is ERC721, Ownable {

    uint256 private MAX_SUPPLY = 7888;
    uint256 private TOTAL_NFT_MINTED = 0;
    uint256 private MAX_NFT_PER_WHITELISTED_ACCOUNT = 10;
    uint256 private MINT_COST_FOR_WHITELISTED = 100000000000000000000 wei;
    uint256 private MINT_COST_FOR_PUBLIC = 140000000000000000000 wei;
    uint256 private RESERVE_FOR_TEAM = 48;
    uint256 private RESERVE_FOR_GIVEAWAYS = 140;

    bool public isWhiteListSaleActive = false;
    bool public isPublicListSaleActive = false;
    bool public isMintingActiveForPublic = true;
    bool public isMintingActiveForWhiteListed = true;
    string public baseExtension = ".json";

    bool public alreadyReservedByTeam = false;
    bool public alreadyReservedForGiveAways = false;

    mapping(address => uint256) private _whiteList;
    address[] private whitelistedAddresses;
    uint256 private whiteListCount = 0;

    string _baseTokenURI;

    constructor(string memory URL) ERC721("Oasis Cactus Genesis", "Ocac" ) {
        setBaseURI(URL);
    }

    function setWhiteListSaleActive(bool _isWhiteListSaleActive) external onlyOwner {
        isWhiteListSaleActive = _isWhiteListSaleActive;
    }

    function setPublicSaleActiveStatus(bool newState) external onlyOwner {
        isPublicListSaleActive = newState;
    }

    function setWhiteList(address[] calldata addresses) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _whiteList[addresses[i]] = MAX_NFT_PER_WHITELISTED_ACCOUNT;
            whitelistedAddresses[whiteListCount] = addresses[i];
            whiteListCount = whiteListCount + 1;
        }
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function reserveForTeam() public onlyOwner{
        require(!alreadyReservedByTeam, "Team has already reserved from this collection. We cannot take more");
        for(uint256 i = 0; i < RESERVE_FOR_TEAM; i++){
            _safeMint(msg.sender, TOTAL_NFT_MINTED);
            TOTAL_NFT_MINTED += 1;
        }
        alreadyReservedByTeam = true;
    }

    function reserveForGiveAways() public onlyOwner{
        require(alreadyReservedByTeam, "Reserve for the team first");
        require(!alreadyReservedForGiveAways, "Team has already reserved for giveaways from this collection. We cannot take more");
        for(uint256 i = 0; i < RESERVE_FOR_GIVEAWAYS; i++){
            _safeMint(msg.sender, TOTAL_NFT_MINTED);
            TOTAL_NFT_MINTED += 1;
        }
        alreadyReservedForGiveAways = true;
    } 

    function mintForWhiteListed(uint256 numberToMint) external payable {
        require(isWhiteListSaleActive, "Whitelisted sale is not active. We appreciate your patience");
        require(isMintingActiveForWhiteListed, "Minting is paused due to some technical reasons. We appreciate your patience");
        require(numberToMint <= _whiteList[msg.sender], "Exceeded max number allowed to be minted by a whitelisted account");
        require(TOTAL_NFT_MINTED + numberToMint <= MAX_SUPPLY, "Cannot mint the required number. Not that many NFTs remaining");
        require(msg.value >= MINT_COST_FOR_WHITELISTED * numberToMint, "Not enough rose sent to mint the desired number of NFTs");

        _whiteList[msg.sender] -= numberToMint;
        for (uint256 i = 0; i < numberToMint; i++) {
            _safeMint(msg.sender, TOTAL_NFT_MINTED);
            TOTAL_NFT_MINTED += 1;
        }
    }

    function mintForPublic(uint256 numberToMint) public payable {
        require(isPublicListSaleActive, "Public sale is not active. We appreciate your patience");
        require(isMintingActiveForPublic, "Minting is paused due to some technical reasons. We appreciate your patience");
        require(numberToMint <= 30, "Cannot mint more than 30 NFTs in a single transcation");
        require(TOTAL_NFT_MINTED + numberToMint < MAX_SUPPLY, "Cannot mint the required number. Not that many NFTs remaining");
        require(msg.value >= MINT_COST_FOR_PUBLIC * numberToMint, "Not enough rose sent to mint the desired number of NFTs");

        for (uint256 i = 0; i < numberToMint; i++) {
            _safeMint(msg.sender, TOTAL_NFT_MINTED);
            TOTAL_NFT_MINTED += 1;
        }
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory)
    {
        require(
        _exists(tokenId),
        "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();
        return bytes(currentBaseURI).length > 0
            ? string(abi.encodePacked(currentBaseURI, Strings.toString(tokenId), baseExtension))
            : "";
    }

    function withdrawBalance() public onlyOwner
    {
        require(address(this).balance > 0, "Balance is 0");
        payable(owner()).transfer(address(this).balance);
    }

    function totalSupply() public view returns (uint256) {
        return MAX_SUPPLY;
    }

    function mintedAlready() public view returns (uint256){
        return TOTAL_NFT_MINTED;
    }

    function maxMintAllowedPerAccountForWhitelistedBeforePublicSale() public view returns (uint256) {
        return MAX_NFT_PER_WHITELISTED_ACCOUNT;
    }

    function mintCostForPublic() public view returns (uint256){
        return MINT_COST_FOR_PUBLIC;
    }

    function mintCostForWhitelisted() public view returns (uint256){
        return MINT_COST_FOR_WHITELISTED;
    }

    function getWhiteListedAddresses() public onlyOwner view returns (address[] memory){
        return whitelistedAddresses;
    }

    function getCountOfWhiteListed() public onlyOwner view returns (uint256){
        return whiteListCount;
    }

    function updateMintCostForPublic(uint256 newCost) public onlyOwner{
        MINT_COST_FOR_PUBLIC = newCost;
    }

    function updateMintCostForWhiteListed(uint256 newCost) public onlyOwner{
        MINT_COST_FOR_WHITELISTED = newCost;
    }

    function setBaseExtension(string memory _newBaseExtension) public onlyOwner {
        baseExtension = _newBaseExtension;
    }

    function pauseMintingForPublic() public onlyOwner{
        isMintingActiveForPublic = false;
    }

    function resumeMintingForPublic() public onlyOwner{
        isMintingActiveForPublic = true;
    }

    function pauseMintingForWhiteListed() public onlyOwner{
        isMintingActiveForWhiteListed = false;
    }

    function resumeMintingForWhiteListed() public onlyOwner{
        isMintingActiveForWhiteListed = true;
    }

    function transferFromTeamToWinner(address winnerAddress, uint256 tokenID) public onlyOwner{
        require(tokenID >=48 && tokenID <= 187, "Token should be from the giveaway fund");
        _safeTransfer(address(owner()), winnerAddress, tokenID, "Congratulations. We have a gift for you.");
    }
}
