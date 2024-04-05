//var expect = require('chai');

//const { time } = require("@openzeppelin/test-helpers");
//const { assert } = require("chai");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const time = require("./helpers/time");
const { BigNumber } = require("ethers");
// const time = require('@openzeppelin-test-helpers');
const utils = require("./helpers/utils");
//const SwarmScan = require("./helpers/swarmscandata.js");
const DBProvider = require("./helpers/databaseProvider.js");


const RedistributionContract = artifacts.require("Redistribution2");
const StakeRegistry = artifacts.require("StakeRegistry");
const PostageStamp = artifacts.require("PostageStamp");
const PriceOracle = artifacts.require("PriceOracle");

const bzzToken = artifacts.require("ERC20");

const storageDepht = 0;
const storageDepthUint8 = web3.utils.toBN(storageDepht).toNumber();
// Make sure the storageDepth is within the range of uint8
if (storageDepthUint8 > 255) {
    throw new Error("Storage depth exceeds the range of uint8");
}


const createCsvWriter = require('csv-writer').createObjectCsvWriter;
// Define the header for your CSV file
const csvWriter = createCsvWriter({
    path: 'output.csv',
    header: [
        { id: 'roundNumber', title: 'Round Number' },
        { id: 'winner', title: 'Winner' },
        { id: 'depth', title: 'Depth' },
        { id: 'stake', title: 'Stake' },
        { id: 'stakeDensity', title: 'Stake Density' },
        { id: 'hash', title: 'Hash' },
        { id: 'pot', title: 'pot' },
        { id: 'reward', title: 'Reward' },
        { id: 'majorityReveal', title: 'MajorityReveal' },
        { id: 'reserveCommitments', title: 'ReserveCommitments' }
    ]
});

contract("Redistribution", (accounts) => {
    let sudo  = accounts[0];
    let NetworkID = 0;
    let minimumBucketDepht = 8;
    let stakingContract;
    let contractInstance;
    let bzzTokenInstance;
    let postageContract;
    let oracleContract;

    let Rounds = []

    let ClaimGasHistory = [];
    let RoundResults = [];
    
    // Helper function to run a redestribution game round
    async function runRedistribute() {


        let overlayAddress1 = "0xb9a68ba4b106a5f47fe0eb03584497960415d61acb9a68505d67ae0c161163b5";
        let overlayAddress2 = "0xb9912334ee75e0232a6d5880cf5ae55c2eb073c3f856f65053a8b502d30087e9";
        let overlayAddress3 = "0xb9bf740e51c47ac8055b0fabb32930f92dbb7db00b75ff7cdaa9e69ffffc5fbb";
        let overlayAddress4 = "0xb997fa6ba783498746ccd9d4f3974e40a4742e98fe20f6db00137f9be802a7aa";
        let overlayAddress5 = "0xb9aae818aa8fa362268bc2b5d09ade25cccc34e3fb787619ef437f8dc78751e1";


        currentBlockNumber = await web3.eth.getBlockNumber();
        console.log("Current block number:", currentBlockNumber);
        timeToNextRound =152 - ( currentBlockNumber % 152) +1
        await time.increaseBlocks(timeToNextRound);
           
        //gonna need some commits
        let reserveCommit1 = "0x5023a503d4e3a81205ef10080590a32b74da4932fab94279e09f11868d00f2be"; 
        let nonce1 = "0x8";
        let reserveCommit2 = "0x40a3d203d4e3a81205af10680290a32b74da4932fab94274e0cf11868d9037a2"; 
        let nonce2 = "0x2";
        let reserveCommit3 = "0x82abdf23d0e308a205af1068c290d32e74daf934fab24214e0c2f11868d907a7"; 
        let nonce3 = "0x3";
        
        let obfuscatedHash1 = await contractInstance.wrapCommit(overlayAddress1,storageDepthUint8,reserveCommit1,nonce1);
        let obfuscatedHash2 = await contractInstance.wrapCommit(overlayAddress2,storageDepthUint8,reserveCommit2,nonce2);
        let obfuscatedHash3 = await contractInstance.wrapCommit(overlayAddress3,storageDepthUint8,reserveCommit3,nonce3);


       
        await time.makeItCommitPhase();
        currentBlockNumber = await web3.eth.getBlockNumber();
        console.log("Current block number:", currentBlockNumber);
        let rndres = await contractInstance.currentRound();
        console.log(rndres.toString());


        //alice and bob not same commit
        let resCommit1 = await contractInstance.commit( obfuscatedHash1 ,overlayAddress1,rndres,{from: alice}); 
        let resCommit2 = await contractInstance.commit( obfuscatedHash2 ,overlayAddress2,rndres,{from: bob}); 
        let resCommit3 = await contractInstance.commit( obfuscatedHash3 ,overlayAddress3,rndres,{from: charlie}); 

        //console.log(resCommit1);


        //need to time travel to reveal phase

        await time.makeItRevealPhase();
       
        let revealStatus = await contractInstance.currentPhaseReveal();
        //console.log(revealStatus);
          //alice
        let reveal1 = await contractInstance.reveal(overlayAddress1, storageDepthUint8, reserveCommit1, nonce1, {from: alice});
        //bob
        let reveal2 = await contractInstance.reveal(overlayAddress2, storageDepthUint8, reserveCommit2, nonce2, {from: bob});
        //charlie
        let reveal3 = await contractInstance.reveal(overlayAddress3, storageDepthUint8, reserveCommit3, nonce3, {from: charlie});

       // console.log(reveal1);
        //console.log(reveal2);
        //console.log(reveal3);

       //time travel claim phase
       await time.makeItClaimPhase();
       txRes = await contractInstance.claim({from: alice})
       ClaimGasHistory.push(txRes.receipt.gasUsed);

       //console.log("Gas used:", txRes.receipt.gasUsed);

    }

    beforeEach(async () => {
         overlayAddresses = [];
         bzzTokenInstance = await bzzToken.new("BZZ","BZZ",{from: sudo});
         sudoMoney = await bzzTokenInstance.allowance(sudo,sudo);
         sudoBalance = await bzzTokenInstance.balanceOf(sudo);

         totalSupply = await bzzTokenInstance.totalSupply();
        

         //needs addresss of BZZ ERC20 token, and swarm network id
         stakingContract = await StakeRegistry.new(bzzTokenInstance.address, NetworkID ,{ from: sudo });


        //  console.log(bzzTokenInstance.address);
        //  console.log(totalSupply.toString());
        // console.log(sudoBalance.toString());
        //  console.log(sudoMoney.toString());
         // need to give moneys
        
         
        let amount =  1000000000000000000000n;
        //  let stakeAmount = 100000000000000000n


         //give everyone funds
         for (let i = 1; i < accounts.length; i++) {
            const currentAccount = accounts[i];
            await bzzTokenInstance.transferFrom(sudo, currentAccount, amount, { from: sudo });
            await bzzTokenInstance.approve(currentAccount,amount, {from: currentAccount});

         }
         
          
      
        // //give stake     
        // // alice needs to give staking contract allowance
        // await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: alice});
        // await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: bob});
        // await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: charlie});
        // await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: david});


        //  let aliceStaked = await stakingContract.depositStake(alice, overlayNonce, stakeAmount,{ from: alice } )
        //  //console.log(aliceStaked.logs[0].args);
        // //  aliceStaked.logs.forEach(l =>{
        // //     if (l.event == "StakeUpdated"){
        // //         console.log(l.args[0]);
        // //         overlayAddress1 = l.args[0];
                
        // //     }
        // //  });

        //  let bobStaked = await stakingContract.depositStake(bob, overlayNonce, stakeAmount,{ from: bob } )
        //  //console.log(aliceStaked.logs[0].args);
        // //  bobStaked.logs.forEach(l =>{
        // //     if (l.event == "StakeUpdated"){
        // //         console.log(l.args[0]);
        // //         overlayAddress2 = l.args[0];
                
        // //     }
        // //  });
        
        //  let charlieStaked = await stakingContract.depositStake(charlie, overlayNonce, stakeAmount,{ from: charlie } )
        //  //console.log(aliceStaked.logs[0].args);
        // //  charlieStaked.logs.forEach(l =>{
        // //     if (l.event == "StakeUpdated"){
        // //         console.log(l.args[0]);
        // //         overlayAddress3 = l.args[0];
                
        // //     }
        // //  });
         
        //  let davidStaked = await stakingContract.depositStake(david, overlayNonce, stakeAmount,{ from: david } )
        //  //console.log(aliceStaked.logs[0].args);
        // //  davidStaked.logs.forEach(l =>{
        // //     if (l.event == "StakeUpdated"){
        // //         console.log(l.args[0]);
        // //         overlayAddress4 = l.args[0];
                
        // //     }
        // //  });


        //needs token, and minimum bucket depth to be paid for
          postageContract = await PostageStamp.new(bzzTokenInstance.address,minimumBucketDepht,{ from: sudo });
          oracleContract = await PriceOracle.new(postageContract.address, { from: sudo });
 
        contractInstance = await RedistributionContract.new(
             stakingContract.address,
             postageContract.address,
             oracleContract.address,
             { from: sudo }
         );
         // give redistribution ability to withdraw
         await postageContract.grantRole(web3.utils.keccak256("REDISTRIBUTOR_ROLE"),contractInstance.address);
         await postageContract.grantRole(web3.utils.keccak256("PRICE_ORACLE"),oracleContract.address);

         await stakingContract.grantRole(web3.utils.keccak256("REDISTRIBUTOR_ROLE"),contractInstance.address);
         await oracleContract.grantRole(web3.utils.keccak256("PRICE_UPDATER"),contractInstance.address);


    });
    context("", async()=>{

        it("Simulate with apidata  ",async () =>{ 

            console.log("data below");

            // Rounds = await new Promise((resolve, reject) => {
            //     DBProvider.getAllRounds((err, rounds) => {
            //         if (err) {
            //             console.error('Error fetching rounds:', err);
            //             reject(err);
            //         } else {
            //             resolve(rounds);
            //         }
            //     });
            // });


             //RoundNumbers = await DBProvider.filterRoundsWithMinorityReveals();
             RoundNumbers = await DBProvider.getChaoticRounds();
            console.log(RoundNumbers);

           //RoundNumbers = RoundNumbers.slice(5000);
           console.log(RoundNumbers);

          
            for (let roundnr of RoundNumbers) {   
                let majorityReserveCommitment= '';
                let reserveCommitmentsCount = {};    

                let round = await new Promise((resolve, reject) => {
                    DBProvider.getRoundData(roundnr, (err, res) => {
                        if (err) {
                            console.error('Error fetching round:', err);
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
                console.log(round);
                // Round didnt finish originally ignore
                if (round.rewardPot == 0){continue;}
               // if (round.countReveals > 9){continue;}

                console.log(round.roundNumber);
                let rndnr = round.roundNumber;
                


                let reveals = await new Promise((resolve, reject) => {
                    DBProvider.getRevealsByRoundNumber(rndnr, (err, res) => {
                        if (err) {
                            console.error('Error fetching reveals:', err);
                            reject(err);
                        } else {
                            //console.log("Reveals fetched successfully");
                            resolve(res);
                        }
                    });
                });
                if (reveals.length > 40){
                    continue;
                }
               
                // let commits = await new Promise((resolve, reject) => {
                //     DBProvider.getCommitsByRoundNumber(rndnr, (err, res) => {
                //         if (err) {
                //             console.error('Error fetching reveals:', err);
                //             reject(err);
                //         } else {
                //             //console.log("Commits fetched successfully");
                //             resolve(res);
                //         }
                //     });
                // });

                //prep
                let commithashes = new Map;
                
                for (let rvl of reveals) {                    
                   
                    accIndex = 0;

                    if(rvl.rid % 9 == 0){
                        accIndex = 1;
                    }else{
                        accIndex = rvl.rid % 9;
                    }

                    await bzzTokenInstance.approve(stakingContract.address, BigNumber.from(rvl.stake.toString()+"0"), {from: accounts[accIndex]});

                    await stakingContract.depositStakeForSimulation(accounts[accIndex], rvl.overlay, BigNumber.from(rvl.stake.toString()),{ from: accounts[ accIndex]}); 


                    //let obfuscatedHash1 = await contractInstance.wrapCommit(overlayAddress1,storageDepthUint8,reserveCommit1,nonce1);
                    let nonce = "0x"+ String(rvl.rid);



                    commithashes[rvl.rid] = await contractInstance.wrapCommit(rvl.overlay, rvl.depth, rvl.reserveCommitment, nonce )

                    const reserveCommitment = rvl.reserveCommitment;
                    reserveCommitmentsCount[reserveCommitment] = (reserveCommitmentsCount[reserveCommitment] || 0) + 1;
                    if (
                        !majorityReserveCommitment ||
                        reserveCommitmentsCount[reserveCommitment] > reserveCommitmentsCount[majorityReserveCommitment]
                    ) {
                        majorityReserveCommitment = reserveCommitment;
                    }
                    
                }

                currentBlockNumber = await web3.eth.getBlockNumber();
                timeToNextRound =152 - ( currentBlockNumber % 152) +1
                await time.increaseBlocks(timeToNextRound);

                await contractInstance.setCurrentRoundAnchor(round.anchor);
                await contractInstance.setCurrentTruthSelectionAnchor(round.revealAnchor);

                await time.makeItCommitPhase();
                let cr = await contractInstance.currentRound();

                for (let rvl of reveals) {                    
                    // console.log(rvl.overlay);
                    // console.log(rvl.stake);
                    // console.log(rvl.rid);
                    // console.log(rvl.depth);
                    // console.log(rvl.reserveCommitment);

                    // console.log(bzzTokenInstance);
                    accIndex = 0;

                    if(rvl.rid % 9 == 0){
                        accIndex = 1;
                    }else{
                        accIndex = rvl.rid % 9;
                    }

            
                    let nonce = "0x"+ String(rvl.rid);



                    let obfuscatedHash =  commithashes[rvl.rid];
                  
                    let resCommit = await contractInstance.commit( obfuscatedHash ,rvl.overlay,cr,{ from: accounts[accIndex]} ); 

                   
                    
                }
                //console.log(reveals);
                await time.makeItRevealPhase();

                for (let rvl of reveals) {                    
                    // console.log(rvl.overlay);
                    // console.log(rvl.stake);
                    // console.log(rvl.rid);
                    // console.log(rvl.depth);
                    // console.log(rvl.reserveCommitment);

                    // console.log(bzzTokenInstance);
                    accIndex = 0;

                    if(rvl.rid % 9 == 0){
                        accIndex = 1;
                    }else{
                        accIndex = rvl.rid % 9;
                    }

                    
                    //let obfuscatedHash1 = await contractInstance.wrapCommit(overlayAddress1,storageDepthUint8,reserveCommit1,nonce1);
                    let nonce = "0x"+ String(rvl.rid);
                    try {
                        let reveal1 = await contractInstance.reveal(rvl.overlay, rvl.depth, rvl.reserveCommitment, nonce, {from: accounts[accIndex]});       
                    }catch{
                        break;
                    }     
                }
                await time.makeItClaimPhase();
               // console.log(BigNumber.from(round.rewardPot.toString()));
                await  bzzTokenInstance.approve( postageContract.address, BigNumber.from(round.rewardPot.toString()) ,{from: sudo})
                await  postageContract.topupPot(BigNumber.from(round.rewardPot.toString()) ,{from: sudo})
                let potAmount = await postageContract.viewTotalPot();
               // console.log("wagasd")
                //console.log(potAmount.toString());
                txRes = await contractInstance.claim({from: accounts[1]});
                //console.log(txRes);


            const events = await contractInstance.getPastEvents("WinnerSelected", {
                fromBlock: currentBlockNumber,
                    toBlock: "latest"
                });
             assert(events.length > 0, "No claim rounds ran");

             const priceUpdates = await oracleContract.getPastEvents("PriceUpdate", {
                fromBlock: currentBlockNumber,
                    toBlock: "latest"
                });

            // assert(priceUpdates.length > 0, "No feedback made to oracle");
             for (let e of priceUpdates){
                console.log(e);

             }
             for (let e of events){
                // console.log("winner selected overlay")
                 //console.log(e.returnValues.winner)
                 _overlay = e.returnValues.winner.overlay;
                 let rres = {
                    roundNumber: round.roundNumber,
                    winner: _overlay,
                    depth: e.returnValues.winner.depth,
                    stake: e.returnValues.winner.stake,
                    stakeDensity: e.returnValues.winner.stakeDensity,
                    hash: e.returnValues.winner.hash,
                    pot: round.rewardPot,
                    reward: potAmount,
                    majorityReveal: majorityReserveCommitment,
                    reserveCommitments: reserveCommitmentsCount
                };
                
                 
                 RoundResults.push(rres);
 
             }
            
            }
            //assert(false);
            //console.log(RoundResults);
            csvWriter.writeRecords(RoundResults)
            .then(() => {
                console.log('CSV file has been written successfully');
            })
            .catch((err) => {
                console.error('Error writing CSV file:', err);
            });
            
        })

     



        

    })

   
   
})