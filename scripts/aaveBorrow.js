const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("./getWeth");


async function main(){
    await getWeth();
    const {deployer} = await getNamedAccounts();

    //Lending Pool Address Provider: 0xb53c1a33016b2dc2ff3653530bff1848a515c8c5
    //Lending Pool
    const lendingPool = await getLendingPool(deployer);
    console.log(`LendingPool Address ${lendingPool.address}`);

    //deposit!!  - the deposit works is aave pull the amount to deposit from the depositAddress, in order to work we first need to approve that aave can spend(in this case deposit) token

    const wethTokenAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);

    console.log("Depositing...");
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
    console.log('Deposited...')


    let {availableBorrowsETH, totalDebtETH}  = await getBorrowUserData(lendingPool, deployer);
    //Borrow
    const daiPrice = await getDaiPrice();
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());
    console.log(`You can borrow ${amountDaiToBorrow} DAI`);
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    console.log(`You can borrow ${amountDaiToBorrowWei} DAI WEI`);

    const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    await borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, deployer)

    await getBorrowUserData(lendingPool, deployer);
    await repay(amountDaiToBorrowWei, daiAddress, lendingPool, deployer);
    console.log('----------------------------------');
    await getBorrowUserData(lendingPool, deployer);
}

async function repay(amount, daiAddress, lendingPool, account){
    await approveErc20(daiAddress, lendingPool.address, amount, account);
    const repayTxn = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTxn.wait(1);
    console.log("Repaid..")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account){
    console.log('Borrowing DAI...')
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1);
    console.log(`You've now Borrowed!!`)
}

async function  getDaiPrice(){
    const daiEthPriceFeed = await ethers.getContractAt("AggregatorV3Interface", "0x773616E4d11A78F511299002da57A0a94577F1f4")
    const price = (await daiEthPriceFeed.latestRoundData())[1];
    console.log(`The DAI/ETH price is ${price.toString()}`);
    return price;
}

async function getBorrowUserData(lendingPool, account){
    const {totalCollateralETH, totalDebtETH, availableBorrowsETH} = await lendingPool.getUserAccountData(account);
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`);
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`);
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`);
    return {availableBorrowsETH, totalDebtETH};
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20",erc20Address,account);
    const tx = await erc20Token.approve(spenderAddress, amountToSpend);
    await tx.wait(1);
    console.log("Approved!!");
}

async function getLendingPool(account){
    const lendingPoolAddressesProvider = await ethers.getContractAt("ILendingPoolAddressesProvider", "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", account)
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool();
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account);
    return lendingPool;
}

main().then(() => process.exit(0))
.catch((err) => {
    console.error(err);
    process.exit(1);
});