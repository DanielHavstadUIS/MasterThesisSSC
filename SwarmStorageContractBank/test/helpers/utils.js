const Web3 = require('web3');
const web3 = new Web3();

async function shouldThrow(promise) {
    try {
        await promise;
        assert(true);
    }
    catch (err) {
        return;
    }
    assert(false, "The contract did not throw.");
    
    }
    
    function generateCommitHash(overlay, depth, hash, revealNonce) {
        // Encode the parameters
        const encodedParams = web3.eth.abi.encodeParameters(
            ['bytes32', 'uint8', 'bytes32', 'bytes32'],
            [overlay, depth, hash, revealNonce]
        );
    
        // Compute the hash
        const commitHash = web3.utils.keccak256(encodedParams);
        
        return commitHash;
    }
    
    module.exports = {
        shouldThrow,
        generateCommitHash
    };