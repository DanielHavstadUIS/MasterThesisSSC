//var expect = require('chai');

//const { time } = require("@openzeppelin/test-helpers");
//const { assert } = require("chai");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const time = require("./helpers/time");
// const time = require('@openzeppelin-test-helpers');
const utils = require("./helpers/utils");



const RedistributionContract = artifacts.require("Redistribution2");
const StakeRegistry = artifacts.require("StakeRegistry");
const PostageStamp = artifacts.require("PostageStamp");
const PriceOracle = artifacts.require("PriceOracle");

const bzzToken = artifacts.require("ERC20");

let overlayAddress1 = "0xb9a68ba4b106a5f47fe0eb03584497960415d61acb9a68505d67ae0c161163b5";
let overlayAddress2 = "0xb9912334ee75e0232a6d5880cf5ae55c2eb073c3f856f65053a8b502d30087e9";
let overlayAddress3 = "0xb9bf740e51c47ac8055b0fabb32930f92dbb7db00b75ff7cdaa9e69ffffc5fbb";
let overlayAddress4 = "0xb997fa6ba783498746ccd9d4f3974e40a4742e98fe20f6db00137f9be802a7aa";
let overlayAddress5 = "0xb9aae818aa8fa362268bc2b5d09ade25cccc34e3fb787619ef437f8dc78751e1";

const storageDepht = 0;
const storageDepthUint8 = web3.utils.toBN(storageDepht).toNumber();
// Make sure the storageDepth is within the range of uint8
if (storageDepthUint8 > 255) {
    throw new Error("Storage depth exceeds the range of uint8");
}

contract("Redistribution", (accounts) => {
    let [sudo,alice, bob, charlie, david] = accounts;
    let overlayNonce = "0x1";
    let overlayAddresses = [];
    let NetworkID = 0;
    let minimumBucketDepht = 8;
    let stakingContract;
    let contractInstance;
    let bzzTokenInstance;

    let ClaimGasHistory = [];

    
    // Helper function to run a redestribution game round
    async function runRedistribute() {
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
         let bzzTokenInstance = await bzzToken.new("BZZ","BZZ",{from: sudo});
         sudoMoney = await bzzTokenInstance.allowance(sudo,sudo);
         sudoBalance = await bzzTokenInstance.balanceOf(sudo);

         totalSupply = await bzzTokenInstance.totalSupply();
        
        //  console.log(bzzTokenInstance.address);
        //  console.log(totalSupply.toString());
        //  console.log(sudoBalance.toString());
        //  console.log(sudoMoney.toString());
         // need to give moneys
        
         
         let amount =  10000000000000000000n;
         //give everyone stake
         await bzzTokenInstance.transferFrom(sudo,alice, amount, { from: sudo });
        await bzzTokenInstance.approve(alice,amount, {from: alice});
         aliceAllowance = await bzzTokenInstance.allowance(alice,alice);
         console.log(aliceAllowance.toString());
            //bob
            await bzzTokenInstance.transferFrom(sudo,bob, amount, { from: sudo });
            await bzzTokenInstance.approve(bob,amount, {from: bob});

            //charlie
            await bzzTokenInstance.transferFrom(sudo,charlie, amount, { from: sudo });
            await bzzTokenInstance.approve(charlie,amount, {from: charlie});
            //david
            await bzzTokenInstance.transferFrom(sudo,david, amount, { from: sudo });
            await bzzTokenInstance.approve(david,amount, {from: david});

         //needs addresss of BZZ ERC20 token, and swarm network id
         stakingContract = await StakeRegistry.new(bzzTokenInstance.address, NetworkID ,{ from: sudo });
        // Listen to the StakeUpdated event

        //give stake     
        let stakeAmount = 100000000000000000n
        // alice needs to give staking contract allowance
        await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: alice});
        await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: bob});
        await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: charlie});
        await bzzTokenInstance.approve(stakingContract.address,stakeAmount*10n, {from: david});


         let aliceStaked = await stakingContract.depositStake(alice, overlayNonce, stakeAmount,{ from: alice } )
         //console.log(aliceStaked.logs[0].args);
         aliceStaked.logs.forEach(l =>{
            if (l.event == "StakeUpdated"){
                console.log(l.args[0]);
                overlayAddress1 = l.args[0];
                
            }
         });

         let bobStaked = await stakingContract.depositStake(bob, overlayNonce, stakeAmount,{ from: bob } )
         //console.log(aliceStaked.logs[0].args);
         bobStaked.logs.forEach(l =>{
            if (l.event == "StakeUpdated"){
                console.log(l.args[0]);
                overlayAddress2 = l.args[0];
                
            }
         });
        
         let charlieStaked = await stakingContract.depositStake(charlie, overlayNonce, stakeAmount,{ from: charlie } )
         //console.log(aliceStaked.logs[0].args);
         charlieStaked.logs.forEach(l =>{
            if (l.event == "StakeUpdated"){
                console.log(l.args[0]);
                overlayAddress3 = l.args[0];
                
            }
         });
         
         let davidStaked = await stakingContract.depositStake(david, overlayNonce, stakeAmount,{ from: david } )
         //console.log(aliceStaked.logs[0].args);
         davidStaked.logs.forEach(l =>{
            if (l.event == "StakeUpdated"){
                console.log(l.args[0]);
                overlayAddress4 = l.args[0];
                
            }
         });


        //needs token, and minimum bucket depth to be paid for
         const postageContract = await PostageStamp.new(bzzTokenInstance.address,minimumBucketDepht,{ from: sudo });
         const oracleContract = await PriceOracle.new(postageContract.address, { from: sudo });
 
        contractInstance = await RedistributionContract.new(
             stakingContract.address,
             postageContract.address,
             oracleContract.address,
             { from: sudo }
         );
         // give redistribution ability to withdraw
         await postageContract.grantRole(web3.utils.keccak256("REDISTRIBUTOR_ROLE"),contractInstance.address);
         await stakingContract.grantRole(web3.utils.keccak256("REDISTRIBUTOR_ROLE"),contractInstance.address);

    });


    xcontext("SetupBankPlayer", async () => {
        //skip round might need to change as blockchain blocks dont depend on our contracts
        

        //get to claim phase with 3 reveals, 2 same, 1 different
        beforeEach(async () => {
            await time.increaseBlocks(152);
           
            //gonna need some commits
            let reserveCommit1 = "0x5023a503d4e3a81205ef10080590a32b74da4932fab94279e09f11868d00f2be"; 
            let nonce1 = "0x8";
            
            let obfuscatedHash1 = await contractInstance.wrapCommit(overlayAddress1,storageDepthUint8,reserveCommit1,nonce1);
            let obfuscatedHash2 = await contractInstance.wrapCommit(overlayAddress2,storageDepthUint8,reserveCommit1,nonce1);
            
            currentBlockNumber = await web3.eth.getBlockNumber();
            //console.log("Current block number:", currentBlockNumber);

            await time.makeItCommitPhase();
            currentBlockNumber = await web3.eth.getBlockNumber();
           // console.log("Current block number:", currentBlockNumber);
            let rndres = await contractInstance.currentRound();
            //console.log(rndres.toString());


            //alice and bob same commit
            let resCommit1 = await contractInstance.commit( obfuscatedHash1 ,overlayAddress1,rndres,{from: alice}); 
            let resCommit2 = await contractInstance.commit( obfuscatedHash2 ,overlayAddress2,rndres,{from: bob}); 
           
            // charlie different
            let reserveCommit2 = "0x40a3d203d4e3a81205af10680290a32b74da4932fab94274e0cf11868d9037a2"; 
            let nonce2 = "0x2";
            let obfuscatedHash3 = await contractInstance.wrapCommit(overlayAddress3,storageDepthUint8,reserveCommit2,nonce2);
            let resCommit3 = await contractInstance.commit( obfuscatedHash3 ,overlayAddress3,rndres,{from: charlie}); 
  
            //console.log(resCommit1);
  
  
            //need to time travel to reveal phase
  
            await time.makeItRevealPhase();
            currentBlockNumber = await web3.eth.getBlockNumber();
            //console.log("Current block number:", currentBlockNumber);
  
            let revealStatus = await contractInstance.currentPhaseReveal();
            //console.log(revealStatus);
              //alice
            let reveal1 = await contractInstance.reveal(overlayAddress1, storageDepthUint8, reserveCommit1, nonce1, {from: alice});
            //bob
            let reveal2 = await contractInstance.reveal(overlayAddress2, storageDepthUint8, reserveCommit1, nonce1, {from: bob});
            //charlie
            let reveal3 = await contractInstance.reveal(overlayAddress3, storageDepthUint8, reserveCommit2, nonce2, {from: charlie});
  
           // console.log(reveal1);
            //console.log(reveal2);
            //console.log(reveal3);
        
            const events = await contractInstance.getPastEvents("Revealed", {
                fromBlock: currentBlockNumber,
                    toBlock: "latest"
                });

             console.log(events[0]);

           //time travel claim phase
           await time.makeItClaimPhase();

  
           currentBlockNumber = await web3.eth.getBlockNumber();
           //console.log("Current block number:", currentBlockNumber);


        })
       
        it("should make the correct reveal to stake map",async () =>{ 
          let claim = await contractInstance.currentPhaseClaim();
          console.log(claim)
          await contractInstance.claim({from: alice})
          
          const events = await contractInstance.getPastEvents("RevealToStakeMapUpdated", {
             fromBlock: 0,
                 toBlock: "latest"
             });
          assert(events.length > 0, "bStake not emitted");
          for (let e of events){
            console.log(e.returnValues.stake);
        }
          let testStake = events[1].returnValues.stake;
          console.log(events[1].returnValues.stake);
          assert.equal(testStake, 200000000000000000n,"Reveal to stake not provided properly")
        })
        //cant do this due to too many local variables makes contract unable to compile
        xit("should make dummy reveal for bank player",async () =>{ 
            let claim = await contractInstance.currentPhaseClaim();
            console.log(claim)
            await contractInstance.claim({from: alice})
            
            const events = await contractInstance.getPastEvents("maxStakeEmitted", {
               fromBlock: 0,
                   toBlock: "latest"
               });
            assert(events.length > 0, "bReveal not emitted");
            let bankReveal = events[0].returnValues.bankReveal;
            console.log(events[0].returnValues.bankReveal);
            assert.equal(bankReveal.overlay, web3.utils.keccak256("BANK"),"Dummy bank reveal not made")
          })
        
    })

    //context allows grouping tests for a specific scenario, 
    //prepending an x before context as in xcontext or xit for a single tests omits testing these tests
    context("Bankwintesting", async () => {
        xit("Bank should at some point win ",async () =>{ 
            console.log("Starting win testing")
            startingBlockNumber = await web3.eth.getBlockNumber();
            //console.log("Current block number:", currentBlockNumber);
    
            n = 15;
            
            await runRedistribute();
            await runRedistribute();
            await runRedistribute();

            const events = await contractInstance.getPastEvents("WinnerSelected", {
               fromBlock: startingBlockNumber,
                   toBlock: "latest"
               });
            assert(events.length > 0, "No claim rounds ran");
            let bankWon = false;
            for (let e of events){
                console.log(e.returnValues)
                console.log("winner overlay");
                console.log(e.returnValues.winner.overlay);
                console.log("bank overlay");
                console.log(web3.utils.keccak256("BANK"));

                if (e.returnValues.winner.overlay == web3.utils.keccak256("BANK")){
                    bankWon = true
                }

            }
           // assert(bankWon,"bank not win yet");

          })
          it("Bank should win proportionally ",async () =>{ 
            ClaimGasHistory = [];
            console.log("Starting win testing")
            



            startingBlockNumber = await web3.eth.getBlockNumber();
            //console.log("Current block number:", currentBlockNumber);
            
            //alter stake levels
            //might need to alter allowances also
            let stakeAmount = 100000000000000000n
           
            let aliceStaked = await stakingContract.depositStake(alice, overlayNonce, stakeAmount*4n,{ from: alice } )
            let bobStaked = await stakingContract.depositStake(bob, overlayNonce, stakeAmount*3n,{ from: bob } )


            aliceStaked.logs.forEach(l =>{
                if (l.event == "StakeUpdated"){
                    console.log(l.args[0]);
                    overlayAddress1 = l.args[0];
                    
                }
             });
            console.log(bobStaked);

            n = 1000;
            //keep track of winners
            winners = new Map()
            winners.set(overlayAddress1,0)
            winners.set(overlayAddress2,0)
            winners.set(overlayAddress3,0)
            winners.set(web3.utils.keccak256("BANK"),0)


            //alter run redistribute so we can redistribute with three different actors

            // run game n times
            for(i=0; i < n; i++){

                await runRedistribute();
            }
            const debugNumbers = await contractInstance.getPastEvents("emitNumber", {
                fromBlock: startingBlockNumber,
                    toBlock: "latest"
                });
            for (let e of debugNumbers){
                console.log(e.returnValues.number.toString())
            }
        

            const events = await contractInstance.getPastEvents("WinnerSelected", {
               fromBlock: startingBlockNumber,
                   toBlock: "latest"
               });
            assert(events.length > 0, "No claim rounds ran");
            let bankWon = false;
            for (let e of events){
                console.log("winner selected overlay")
                console.log(e.returnValues.winner.overlay)
                _overlay = e.returnValues.winner.overlay;
                winners.set(_overlay,winners.get(_overlay)+1)

            }

            //count how many times each won out of n 
            winners.forEach (function(value, key) {
                console.log(key)
                console.log(value)
                console.log(value/n)
              })
            console.log("minGas: ", Math.min(...ClaimGasHistory))
            console.log("maxGas: ", Math.max(...ClaimGasHistory))
            
            var total = 0;
            for(var i = 0; i < ClaimGasHistory.length; i++) {
                total += ClaimGasHistory[i];
            }
            var avg = total / ClaimGasHistory.length;


            console.log("meanGas: ", avg);

            //assert(bankWon);

          })
    })
})