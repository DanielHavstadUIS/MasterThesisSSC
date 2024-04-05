const fs = require('fs');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
// Define the header for your CSV file
const csvWriter = createCsvWriter({
    path: 'modoutput.csv',
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


const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const DBProvider = require("./test/helpers/databaseProvider.js");


const bank_overlay =  web3.utils.keccak256("BANK")
 

// Path to the CSV file
const csvFilePath = 'alphaSQRTResultsfixed.csv';
//const csvFilePath = 'banksolResults.csv';
//const csvFilePath = 'bankSolChaosResults.csv';

//const csvFilePath = 'modoutput.csv';

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
            pot: row['pot'],
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

//majorityReveal was faulty
async function updateMajorityReveal() {
    try {
      // Read the CSV file
      const CSVDATA = await readCSVFile(csvFilePath);

      // Loop through each row in the CSV data
      for (const rowData of CSVDATA) {
          //console.log(rowData.roundNumber);
          // Fetch the reveals data for the current round number
          const revealsData = await new Promise((resolve, reject) => {
            DBProvider.getRevealsByRoundNumber(rowData.roundNumber, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });

          const totalReveals = revealsData.length;
          // Get the most common reserveCommitment value from the reveals data
          const reserveCommitmentsCount = {};
          for (const reveal of revealsData) {
             // console.log(reveal)
              const reserveCommitment = reveal.reserveCommitment;
              reserveCommitmentsCount[reserveCommitment] = (reserveCommitmentsCount[reserveCommitment] || 0) + 1;
          }
          console.log(reserveCommitmentsCount)
          const mostCommonCommitment = Object.keys(reserveCommitmentsCount).reduce((a, b) => reserveCommitmentsCount[a] > reserveCommitmentsCount[b] ? a : b);
         // const mostCommonCommitmentCount = reserveCommitmentsCount[mostCommonCommitment];

          // Update the majorityReveal field with the most common reserveCommitment value
          rowData.majorityReveal = mostCommonCommitment;

          // Check if the majority reveal count is greater than half of the total reveals
          // if (mostCommonCommitmentCount <= totalReveals / 2) {
          //   // Remove the current row from the CSV data
          //   CSVDATA.splice(CSVDATA.indexOf(rowData), 1);
          // } 

      }

      // Write the updated CSV data to a new file
      await csvWriter.writeRecords(CSVDATA);

      console.log('CSV file updated successfully.');
  } catch (error) {
      console.error('Error updating CSV file:', error);
  }
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
    console.log(`Number of rounds where bank wins: ${amountBankwins}`);
    console.log(`Percentage of rounds where minority wins: ${(numberMinoritywins / CSVDATA.length) * 100}%`);
    console.log(`Percentage of rounds where majority wins: ${(numberMajorityWins / CSVDATA.length) * 100}%`);
    console.log(`Percentage of rounds won by the bank: ${(amountBankwins / CSVDATA.length) * 100}%`);



    } catch (error) {
      console.error('Error reading CSV file:', error);
    }
  }
  
 //updateMajorityReveal();
//processData();




// Call the function to plot roundNumbers vs depth
//plotRoundVsDepth();
console.log(bank_overlay);