const { makeItRevealPhase } = require('./time');

const sqlite3 = require('sqlite3').verbose();

// Path to your SQLite database file
const dbPath = './test/helpers/swarmscan.db';


function getAllRounds(callback) {
    const db = new sqlite3.Database(dbPath);

    db.all('SELECT * FROM rounds', (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });

    db.close();
}

// Function to get round data by round number
function getRoundData(roundNumber, callback) {
    const db = new sqlite3.Database(dbPath);

    db.get('SELECT * FROM rounds WHERE roundNumber = ?', [roundNumber], (err, row) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, row);
        }
    });

    db.close();
}

// Function to get reveals by round number
function getRevealsByRoundNumber(roundNumber, callback) {
    let db = new sqlite3.Database(dbPath);

    db.all('SELECT * FROM reveals WHERE roundNumber = ?', [roundNumber], (err, rows) => {
        if (err) {

            callback(err, null);
        } else {

            callback(null, rows);
        }
        db.close();

    });

}

// Function to get all reveals
function getAllReveals(callback) {
    let db = new sqlite3.Database(dbPath);

    db.all('SELECT * FROM reveals', (err, rows) => {
        if (err) {
            console.error("Error fetching data from reveals:", err);
            callback(err, null);
        } else {
            console.log("Data fetched from reveals:", rows);
            callback(null, rows);
        }

        // Close the database connection after the query completes
        db.close();
    });
}


// Function to get commits by round number
async function getCommitsByRoundNumber(roundNumber, callback) {
    let db = new sqlite3.Database(dbPath);

    db.all('SELECT * FROM commits WHERE roundNumber = ?', [roundNumber], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });

    db.close();
}


// Function to count overlays in reveals table
function countNumberOfRevealsByOverlay(callback) {
    let db = new sqlite3.Database(dbPath);

    const overlayCounts = {};

    // Query to count overlays
    const query = `SELECT overlay, COUNT(*) AS count FROM reveals GROUP BY overlay`;

    // Execute the query
    db.all(query, (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }

        // Process the result rows
        rows.forEach(row => {
            overlayCounts[row.overlay] = row.count;
        });

        // Sort overlay counts by count in descending order
        const sortedOverlayCounts = Object.entries(overlayCounts)
            .filter(([overlay, count]) => count > 20)
            .sort((a, b) => b[1] - a[1]); // Sort by count in descending order

        // Log the sorted overlay counts
        console.log('Overlay Counts (Sorted):');
        console.log(sortedOverlayCounts);
        callback(null, sortedOverlayCounts);
        db.close();
    });
}

function deleteObsoleteRounds(){
    // round 180241 and below dont provide anchors ..
    let db = new sqlite3.Database(dbPath);
    const sqlStatements = [
        "DELETE FROM rounds WHERE roundNumber <= 180241;",
        "DELETE FROM reveals WHERE roundNumber <= 180241;",
        "DELETE FROM commits WHERE roundNumber <= 180241;",
        "DELETE FROM originalWinners WHERE roundNumber <= 180241;",
        "DELETE FROM originalFrozens WHERE roundNumber <= 180241;"
    ];
        // Execute each SQL statement
    sqlStatements.forEach(sql => {
        db.run(sql, function(err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Rows deleted: ${this.changes}`);
            }
        });
    });

    // Close the database connection
    db.close();
}


function getAllRoundsWithMinorityReveals(callback) {
    // Query originalFrozens to get all roundNumbers
    let db = new sqlite3.Database(dbPath);

    const query = `SELECT DISTINCT roundNumber FROM originalFrozens`;

    // Execute the query
    db.all(query, (err, rows) => {
        if (err) {
            console.error(err.message);
            callback(err, null);
            return;
        }

        // Extract roundNumbers from the result rows
        const roundNumbers = rows.map(row => row.roundNumber);

        callback(null, roundNumbers);
    });
}

//this is 7580 rounds
//removing rounds where majority reveal must be at least half of all revealse it is 6995 rounds
async function filterRoundsWithMinorityReveals() {
    let filteredRndNumbers = []
    try {
            const roundNumbers = await new Promise((resolve,reject)=> { getAllRoundsWithMinorityReveals((err,data)=>{
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }

                });
            });
            filteredRndNumbers = [...roundNumbers];
            console.log(roundNumbers.length);
            for (const roundNumber of roundNumbers) {

                const roundData = await new Promise((resolve, reject) => {
                    getRoundData(roundNumber, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });

                const revealsData = await new Promise((resolve, reject) => {
                    getRevealsByRoundNumber(roundNumber, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });

                const roundInfo = {
                    roundNumber: roundNumber,
                    totalReveals: revealsData.length,
                    majorityReserveCommitment: '',
                    reserveCommitments: {}
                };
                const reserveCommitmentsCount = {};

                for (const reveal of revealsData){
                    
                    const reserveCommitment = reveal.reserveCommitment;
                    //console.log(reserveCommitment);
                    // Count occurrences of reserveCommitment
                    reserveCommitmentsCount[reserveCommitment] = (reserveCommitmentsCount[reserveCommitment] || 0) + 1;

                    // Update majorityReserveCommitment if needed
                    if (
                        !roundInfo.majorityReserveCommitment ||
                        reserveCommitmentsCount[reserveCommitment] > reserveCommitmentsCount[roundInfo.majorityReserveCommitment]
                    ) {
                        roundInfo.majorityReserveCommitment = reserveCommitment;
                    }
                }
                roundInfo.reserveCommitments = reserveCommitmentsCount;
                
                // Check if majority reserve commitment has at least half the votes
                const majorityVotes = roundInfo.reserveCommitments[roundInfo.majorityReserveCommitment];
                const totalVotes = roundInfo.totalReveals;
                if (!(majorityVotes >= totalVotes / 2)) {
                    filteredRndNumbers = filteredRndNumbers.filter(num => num !== roundNumber);
                }
                if (roundData.revealAnchor ==null){
                    filteredRndNumbers = filteredRndNumbers.filter(num => num !== roundNumber);
                }
                  
                if (Object.keys(roundInfo.reserveCommitments).length < 2){
                    filteredRndNumbers = filteredRndNumbers.filter(num => num !== roundNumber);
                }
              // console.log(`Round Number: ${roundNumber}`);
              //  console.log(`Total Reveals: ${revealsData.length}`);
               // console.log(`Reveals:`);
               // console.log(roundInfo.reserveCommitments)
               // console.log(`Majority Reveal: ${roundInfo.majorityReserveCommitment}`);
            }
    console.log(filteredRndNumbers.length);
    return filteredRndNumbers;
    } catch (error) {
        console.error('Error fetching round numbers:', error);
    }
}

async function getChaoticRounds() {
    let filteredRndNumbers = []
    try {
            const roundNumbers = await new Promise((resolve,reject)=> { getAllRoundsWithMinorityReveals((err,data)=>{
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }

                });
            });
            filteredRndNumbers = [...roundNumbers];
            console.log(roundNumbers.length);
            for (const roundNumber of roundNumbers) {

                const roundData = await new Promise((resolve, reject) => {
                    getRoundData(roundNumber, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });

                const revealsData = await new Promise((resolve, reject) => {
                    getRevealsByRoundNumber(roundNumber, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });

                const roundInfo = {
                    roundNumber: roundNumber,
                    totalReveals: revealsData.length,
                    majorityReserveCommitment: '',
                    reserveCommitments: {}
                };
                const reserveCommitmentsCount = {};

                for (const reveal of revealsData){
                    
                    const reserveCommitment = reveal.reserveCommitment;
                    //console.log(reserveCommitment);
                    // Count occurrences of reserveCommitment
                    reserveCommitmentsCount[reserveCommitment] = (reserveCommitmentsCount[reserveCommitment] || 0) + 1;

                    // Update majorityReserveCommitment if needed
                    if (
                        !roundInfo.majorityReserveCommitment ||
                        reserveCommitmentsCount[reserveCommitment] > reserveCommitmentsCount[roundInfo.majorityReserveCommitment]
                    ) {
                        roundInfo.majorityReserveCommitment = reserveCommitment;
                    }
                }
                roundInfo.reserveCommitments = reserveCommitmentsCount;
                
                // Check if majority reserve commitment has at least half the votes
                const majorityVotes = roundInfo.reserveCommitments[roundInfo.majorityReserveCommitment];
                const totalVotes = roundInfo.totalReveals;
                if ((majorityVotes >= totalVotes / 2)) {
                    filteredRndNumbers = filteredRndNumbers.filter(num => num !== roundNumber);
                }
                if (roundData.revealAnchor ==null){
                    filteredRndNumbers = filteredRndNumbers.filter(num => num !== roundNumber);
                }

              // console.log(`Round Number: ${roundNumber}`);
              //  console.log(`Total Reveals: ${revealsData.length}`);
               // console.log(`Reveals:`);
               // console.log(roundInfo.reserveCommitments)
               // console.log(`Majority Reveal: ${roundInfo.majorityReserveCommitment}`);
            }
    console.log(filteredRndNumbers.length);
    return filteredRndNumbers;
    } catch (error) {
        console.error('Error fetching round numbers:', error);
    }
}



// Function to select round numbers from reveals for a given overlay
function selectRoundNumbersByOverlay(overlay, callback) {
    let db = new sqlite3.Database(dbPath);

    const sql = `SELECT roundNumber FROM reveals WHERE overlay = ?`;

    db.all(sql, [overlay], (err, rows) => {
        if (err) {
            console.error(err.message);
            callback([]);
        } else {
            const roundNumbers = rows.map(row => row.roundNumber);
            callback(roundNumbers);
        }
    });

    db.close();
}

// Function to select data from rounds table for each round number
function selectRoundDataFromRounds(roundNumbers, callback) {
    let db = new sqlite3.Database(dbPath);

    const roundData = [];

    roundNumbers.forEach(roundNumber => {
        const sql = `SELECT * FROM rounds WHERE roundNumber = ?`;

        db.get(sql, [roundNumber], (err, row) => {
            if (err) {
                console.error(err.message);
            } else {
                roundData.push(row);
                if (roundData.length === roundNumbers.length) {
                    callback(roundData);
                }
            }
        });
    });

    db.close();
}

// Function to select data from reveals table for each round number
function selectRoundDataFromReveals(roundNumbers, callback) {
    let db = new sqlite3.Database(dbPath);

    const roundData = [];

    roundNumbers.forEach(roundNumber => {
        const sql = `SELECT * FROM reveals WHERE roundNumber = ?`;

        db.all(sql, [roundNumber], (err, rows) => {
            if (err) {
                console.error(err.message);
            } else {
                roundData.push(rows);
                if (roundData.length === roundNumbers.length) {
                    callback(roundData);
                }
            }
        });
    });

    db.close();
}

function analyseOverlayRoundHistory(overlay,callback) {
    let roundInfoArray = [];
    selectRoundNumbersByOverlay(overlay, async (roundNumbers) => {
        //console.log(roundNumbers);
        for (const roundNumber of roundNumbers) {
                getRevealsByRoundNumber(roundNumber, (err, revealsData) => {
                if (err) {
                    console.error(err);
                    return;
                }

                let overlayReserveCommitment;

                const roundInfo = {
                    roundNumber: roundNumber,
                    totalReveals: 0,
                    majorityReserveCommitment: '',
                    overlayReserveCommitment: '',
                    overlayReserveCommitmentCount: 0,
                    reserveCommitments: {}
                };

                // Count total reveals in the round
                roundInfo.totalReveals = revealsData.length;

                // Count the occurrence of each reserveCommitment
                const reserveCommitmentsCount = {};
                for (const reveal of revealsData) {
                    const reserveCommitment = reveal.reserveCommitment;
                    //console.log(reserveCommitment);
                    // Count occurrences of reserveCommitment
                    reserveCommitmentsCount[reserveCommitment] = (reserveCommitmentsCount[reserveCommitment] || 0) + 1;

                    // Update majorityReserveCommitment if needed
                    if (
                        !roundInfo.majorityReserveCommitment ||
                        reserveCommitmentsCount[reserveCommitment] > reserveCommitmentsCount[roundInfo.majorityReserveCommitment]
                    ) {
                        roundInfo.majorityReserveCommitment = reserveCommitment;
                    }

                    // Count overlay's reserveCommitment
                    if (reveal.overlay === overlay) {
                        roundInfo.overlayReserveCommitment = reveal.reserveCommitment;
                        overlayReserveCommitment = reveal.reserveCommitment;
                    }
                }
                for (const reveal of revealsData) {
                     // Count overlay's reserveCommitment
                     if (reveal.reserveCommitment=== overlayReserveCommitment) {
                        roundInfo.overlayReserveCommitmentCount += 1;
                    }
                }

                // Assign reserveCommitments and their counts
                roundInfo.reserveCommitments = reserveCommitmentsCount;

                roundInfoArray.push(roundInfo);
                //console.log(roundInfo);
                // Check if all rounds have been processed
                if (roundInfoArray.length === roundNumbers.length) {
                    // Process the roundInfoArray to find desired statistics
                    const totalRounds = roundInfoArray.length;
                    let minorityReserveCount = 0;
                    let differentReserveCount = 0;
                    let roundsWithOverlayReserveInMinority = 0;

                    for (const info of roundInfoArray) {
                        const reserveCommitmentCount = Object.keys(info.reserveCommitments).length;
                        if (reserveCommitmentCount > 1) {
                            differentReserveCount++;
                        }
                      
                        if (info.overlayReserveCommitment !== info.majorityReserveCommitment) {
                            minorityReserveCount++;
                        }
                    }

                   // console.log("Total Rounds:", totalRounds);
                   // console.log("Rounds with different reserve commitments:", differentReserveCount);
                    //console.log("Rounds where overlay's reserve commitment was different from majority:", minorityReserveCount);

                    // Prepare the statistics to be passed to the callback function
                    const statistics = {
                        totalRounds: totalRounds,
                        differentReserveCount: differentReserveCount,
                        minorityReserveCount: minorityReserveCount
                    };

                    // Call the callback function with the statistics
                    callback(statistics);

                    
                }
            });
        }
    });
}


async function findMostSuitableRoundHistory(k) {
    let highestMinorityReserveCount = -1;
    let mostSuitableOverlay;

    let topOverlays = [];

    try {
        const sortedOverlayCounts = await new Promise((resolve, reject) => {
            countNumberOfRevealsByOverlay((err, counts) => {
                if (err) reject(err);
                else resolve(counts);
            });
        });

        i = 0;
        for (const overlayCountMap of sortedOverlayCounts) {
            i++;
            if(i % 100 == 0){
                console.log("currentCompletion:")
                console.log(i);
                console.log(i/sortedOverlayCounts.length);

            }

            const overlay = overlayCountMap[0];

            const statistics = await new Promise((resolve, reject) => {
                analyseOverlayRoundHistory(overlay, (stats) => {
                    resolve(stats);
                });
            });

            if (topOverlays.length < k) {
                topOverlays.push({ overlay, count: statistics.minorityReserveCount });
            } else {
                const minCountOverlay = topOverlays.reduce((minOverlay, currentOverlay) =>
                    minOverlay.count < currentOverlay.count ? minOverlay : currentOverlay
                );

                if (statistics.minorityReserveCount > minCountOverlay.count) {
                    topOverlays = topOverlays.filter((o) => o !== minCountOverlay);
                    topOverlays.push({ overlay, count: statistics.minorityReserveCount });
                }
            }

            //console.log('Total Rounds:', statistics.totalRounds);
            //console.log('Rounds with different reserve commitments:', statistics.differentReserveCount);
            //console.log('Rounds where overlay\'s reserve commitment was different from majority:', statistics.minorityReserveCount);

            if (statistics.minorityReserveCount > highestMinorityReserveCount) {
                highestMinorityReserveCount = statistics.minorityReserveCount;
                mostSuitableOverlay = overlay;
            }
        }

        // Sort top overlays by minorityReserveCount in descending order
        topOverlays.sort((a, b) => b.count - a.count);

        console.log(`Top ${k} overlays with the highest minorityReserveCount:`);
        topOverlays.forEach((o, index) => {
            console.log(`${index + 1}. Overlay: ${o.overlay}, Minority Reserve Count: ${o.count}`);
        });

        // console.log('Overlay with most minority reveals:');
        // console.log(mostSuitableOverlay);
        // console.log(highestMinorityReserveCount);
    } catch (error) {
        console.error('Error:', error);
    }
}


//const overlay = '0xf9eafe102187d4eb25e745b2998f4fe38706e1ebaad64c1f0c4c69ad08911f24';
//analyseOverlayRoundHistory(overlay);

//findMostSuitableRoundHistory(10);
//analyseRoundsWithMinorityReveals();

//deleteObsoleteRounds();
// Call the function to count overlays
//countNumberOfRevealsByOverlay();

module.exports = {
    getAllRounds,
    getAllRoundsWithMinorityReveals,
    filterRoundsWithMinorityReveals,
    getChaoticRounds,
    getRoundData,
    getAllReveals,
    getRevealsByRoundNumber,
    getCommitsByRoundNumber
};