const fs = require('fs');
const csvParser = require('csv-parser');
const { web3 } = require("@openzeppelin/test-helpers/src/setup");


const bank_overlay =  web3.utils.keccak256("BANK")
 

// Path to the CSV file
const csvFilePath = 'output.csv';

async function readCSVFile(csvFilePath) {
    return new Promise((resolve, reject) => {
      const CSVDATA = [];
      fs.createReadStream(csvFilePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const object = {
            roundNumber: row['Round Number'],
            winner: row['Winner'],
            depth: row['Depth'],
            stake: row['Stake'],
            stakeDensity: row['Stake Density'],
            hash: row['Hash'],
            reward: row['Reward'],
            majorityReveal: row['MajorityReveal'],
            reserveCommitments: row['ReserveCommitments']
          };
          CSVDATA.push(object);
        })
        .on('end', () => {
          resolve(CSVDATA);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async function processData() {
    try {
      const CSVDATA = await readCSVFile(csvFilePath);
      console.log(CSVDATA); // Log the objects from the CSV
      // Further processing with the objects
      let numberMinoritywins = 0;
    let amountMinorityReward = BigInt(0);;

    let numberMajorityWins = 0;
    let amountMajorityReward = BigInt(0);;

    let amountBankwins = 0;

    for ( let r of CSVDATA){
        console.log(r);
        const reward = BigInt(r.reward);
        if(r.hash == r.majorityReveal){
            numberMajorityWins++;
            amountMajorityReward += reward;
        }
        if(r.winner == bank_overlay){
            amountBankwins++;
        }else if(r.hash != r.majorityReveal){
            numberMinoritywins++;
            amountMinorityReward += reward;
        }


    }

    console.log(`Number of rounds where minority wins: ${numberMinoritywins}`);
    console.log(`Amount rewarded to minority: ${amountMinorityReward}`);
    console.log(`Number of rounds where majority wins: ${numberMajorityWins}`);
    console.log(`Amount rewarded to majority: ${amountMajorityReward}`);
    console.log(`Amount won by the bank: ${amountBankwins}`);
    console.log(`Percentage of rounds where minority wins: ${(numberMinoritywins / CSVDATA.length) * 100}%`);
    console.log(`Percentage of rounds where majority wins: ${(numberMajorityWins / CSVDATA.length) * 100}%`);
    console.log(`Percentage of rounds won by the bank: ${(amountBankwins / CSVDATA.length) * 100}%`);



    } catch (error) {
      console.error('Error reading CSV file:', error);
    }
  }
  

  processData();