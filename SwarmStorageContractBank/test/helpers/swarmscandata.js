const axios = require('axios');
const fs = require('fs');



// Define a function to fetch data from the Swarmscan API
async function fetchDataFromSwarmscan(n) {
    //const untilT = new Date(Date.now() - until);

    const apiUrl = 'https://api.swarmscan.io/v1/redistribution/rounds';
    try {
        //round 205956 is the cutoff point before the contract im using was paused on gnosis 2023-12-06T12:37:55Z
        // round 168270 seeems to be the earliest round that there is still data for "2022-12-22T11:47:50Z"
        // this amounts to a possible 37686 rounds
        // round 195000 is of some significance as a spike in rounds with less users
        // round 180241 and below dont provide anchors ..
        // this amounts to a possible 25715 rounds

        let next = 205956;
        let rounds = [];
        let totalReward = 0;
        let k = 0;

        while (k<n) {
            let url = apiUrl;
            if (next !== 0) {
                url = `${apiUrl}?start=${next}`;
            }
            //console.log(url)
            const response = await axios.get(url);
            const { data } = response;
            
            rounds = rounds.concat(data.rounds);
            //console.log(rounds);
            console.log(rounds.length);
            next = data.next;
            k = rounds.length;
        }
        return rounds
    } catch (error) {
        console.error('Error:', error);
    }
}

  
  
  // Export the function to make it available in other JavaScript files
module.exports = {
    fetchDataFromSwarmscan,
};