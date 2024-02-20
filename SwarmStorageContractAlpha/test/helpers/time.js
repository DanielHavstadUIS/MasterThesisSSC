const increase = async (duration) => {
    // Convert duration to seconds

    // Increase time
    await new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [duration], // Duration in seconds, there are 86400 seconds in a day
            id: new Date().getTime()
        }, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });

    // Mine a new block
    await new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime() + 1
        }, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
};

const increaseBlocks = async (times) => {
    if (times <= 0) {
        return; // Exit condition for the recursion
    }

    await new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime()
        }, async (error, result) => {
            if (error) {
                reject(error);
            } else {
                // Recursively call increaseBlocks with times decremented
                await increaseBlocks(times - 1);
                resolve(result);
            }
        });
    });
};

//round length 152
const makeItCommitPhase = async()=>{
    let currentBlockNumber = await web3.eth.getBlockNumber();
    let blockNumberModRoundLength =currentBlockNumber  % 152;
    if (blockNumberModRoundLength  % 152 < 38 ){
        return;
    } else if(blockNumberModRoundLength < 76){
        let numBlockIncrease = (76-blockNumberModRoundLength)+76;
        await increaseBlocks(numBlockIncrease);
    } else if(blockNumberModRoundLength< 152){
        let numBlockIncrease = (152-blockNumberModRoundLength)+1;
        await increaseBlocks(numBlockIncrease);
    }

};

const makeItRevealPhase = async()=>{
    let currentBlockNumber = await web3.eth.getBlockNumber();
    let blockNumberModRoundLength =currentBlockNumber  % 152;
    if (blockNumberModRoundLength  % 152 < 38 ){
        let numBlockIncrease = (38-blockNumberModRoundLength)+1;
        await increaseBlocks(numBlockIncrease);
    } else if(blockNumberModRoundLength < 76){
        return;
    } else if(blockNumberModRoundLength< 152){
        let numBlockIncrease = (152-blockNumberModRoundLength)+1;
        await increaseBlocks(numBlockIncrease);
    }

};

const makeItClaimPhase = async()=>{
    let currentBlockNumber = await web3.eth.getBlockNumber();
    let blockNumberModRoundLength =currentBlockNumber  % 152;
    if (blockNumberModRoundLength  % 152 < 38 ){
        let numBlockIncrease = (38-blockNumberModRoundLength)+(76-38)+1;
        await increaseBlocks(numBlockIncrease);
    } else if(blockNumberModRoundLength < 76){
        let numBlockIncrease = (76-blockNumberModRoundLength)+1;
        await increaseBlocks(numBlockIncrease);
    } else if(blockNumberModRoundLength< 152){
       return;
    }

};



const duration = {
    seconds: function (val) {
        return val;
    },
    minutes: function (val) {
        return val * this.seconds(60);
    },
    hours: function (val) {
        return val * this.minutes(60);
    },
    days: function (val) {
        return val * this.hours(24);
    },
};

module.exports = {
    increase,
    increaseBlocks,
    duration,
    makeItCommitPhase, makeItRevealPhase, makeItClaimPhase,
};
