const sqlite3 = require('sqlite3').verbose();
const SwarmScan = require("./swarmscandata.js");
const fs = require('fs');


// Path to your database file
const dbPath = './swarmscan.db';

// Delete the existing database file if it exists
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Previous database file deleted.');
}

// Open a SQLite database on the filesystem
const db = new sqlite3.Database(dbPath);
// Create a table to store rounds data
db.serialize(() => {
    db.run("CREATE TABLE rounds (roundNumber INTEGER PRIMARY KEY, anchor TEXT, revealAnchor TEXT, rewardPot INTEGER, countCommits INTEGER, countReveals INTEGER)");
    db.run("CREATE TABLE reveals (rid INTEGER, roundNumber INTEGER, overlay TEXT, stake INTEGER, stakeDensity INTEGER, reserveCommitment TEXT, depth INTEGER, PRIMARY KEY (rid, roundNumber))"); 
    db.run("CREATE TABLE commits (cid INTEGER, roundNumber INTEGER, overlay TEXT, PRIMARY KEY (cid, roundNumber))");
    db.run("CREATE TABLE originalWinners (roundNumber INTEGER PRIMARY KEY, overlay TEXT, depth INTEGER, stake INTEGER, stakeDensity INTEGER, hash TEXT, rewardAmount INTEGER, postageStampPriceUpdate INTEGER, storagePriceUpdate INTEGER)");
    db.run("CREATE TABLE originalFrozens (fid INTEGER, roundNumber INTEGER, hashSlashed TEXT, overlay TEXT,PRIMARY KEY (fid, roundNumber))");


});

// Function to insert rounds data into the SQLite database
async function insertRoundsIntoDatabase(rounds) {
    rounds.forEach(round => {
        
        let rAnchor = "";
        let rewardPot = 0;
        let rvlcnt = 0;
        let cmtcnt = 0;

        //temp counters for cid and rid and fid
        let crrvlcnt = 1;
        let crcmtcnt = 1;
        let crfrzcnt = 1;

        round.events.forEach(event => {

            if(event.type == "claim transaction"){
                rewardPot = event.rewardAmount;
                rvlcnt = event.countReveals;
                cmtcnt = event.countCommits;
                if (event.stakeFrozen != null){
                    event.stakeFrozen.forEach(loser => {
                        db.run("INSERT INTO originalFrozens (fid, roundNumber, hashSlashed, overlay) VALUES (?,?,?, ?)",
                        crfrzcnt, round.roundNumber, loser.slashed,loser.account);
                        crfrzcnt++;
                    });
                }
                

                db.run("INSERT INTO originalWinners (roundNumber, overlay, depth, stake, stakeDensity, hash, rewardAmount, postageStampPriceUpdate, storagePriceUpdate) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)",
                    round.roundNumber,event.winner.overlay , event.winner.depth,event.winner.stake, event.winner.stakeDensity, event.winner.hash, event.rewardAmount,event.postageStampPriceUpdate, event.storagePriceUpdate );
            }

            switch(event.name) {
                case "revealed":
                  db.run("INSERT INTO reveals (rid, roundNumber, overlay, stake, stakeDensity, reserveCommitment, depth) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     crrvlcnt,round.roundNumber, event.data.overlay, event.data.stake, event.data.stakeDensity, event.data.reserveCommitment, event.data.depth);
                  crrvlcnt++;
                  break;
                case "committed":
                    db.run("INSERT INTO commits (cid, roundNumber, overlay) VALUES (?, ?, ?)",
                     crcmtcnt, round.roundNumber,event.data.overlay);
                  crcmtcnt++;
                  break;
                case "current-reveal-anchor":
                  rAnchor = event.data.anchor;
                  break;
                case "truth-selected":
                  
                  break;
                default:
                  // code block
              } 

        });
        console.log("round inserted")
        db.run("INSERT INTO rounds (roundNumber, anchor, revealAnchor, rewardPot, countCommits, countReveals) VALUES (?, ?, ?, ?, ?, ?)",
        round.roundNumber,round.anchor,rAnchor,rewardPot,cmtcnt,rvlcnt);
    });
}

// Fetch data from Swarmscan API and insert it into the database
async function setupDB(numberOfRoundsToFetch) {
    try {
        const roundsData = await SwarmScan.fetchDataFromSwarmscan(numberOfRoundsToFetch);
        await insertRoundsIntoDatabase(roundsData);
        console.log('Rounds data inserted into the SQLite database successfully.');
    } catch (error) {
        console.error('Error fetching data from Swarmscan API:', error);
    }
}

// Call the function to fetch data and insert it into the database
const numberOfRoundsToFetch = 37686;
setupDB(numberOfRoundsToFetch);

// Close the database connection when done
// process.on('exit', () => {
//     db.close();
// });

// Export the function to insert rounds data
// module.exports = {
//     setupDB
// };