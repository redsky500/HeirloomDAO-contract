const {getCurrentBlockTimestamp} = require('./blocks.js');
async function main (){
    const timestamp = await getCurrentBlockTimestamp(); 
    return timestamp; 
}

main().then(r => console.log(r));