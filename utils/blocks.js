async function getCurrentBlockTimestamp(provider) {
    const currentBlock = await provider.eth.getBlockNumber(); 
    const { timestamp } = await provider.eth.getBlock(currentBlock);
    return timestamp;
}

async function getStartSaleTimestamp(provider, startDate, future = undefined) {
    const start = !future ? Math.round(Number(startDate.getTime() / 1000)) : Math.round(Number(startDate.getTime() / 1000) + future);
    const blockTimestamp = await getCurrentBlockTimestamp(provider);
    const diff = Math.round(Number(start) - Number(blockTimestamp));
    // only start that is 5 min in the future will be accepted as valid; 
    if (diff >= (60 * 5)) return String(Math.round(start)); 
    // otherwise we use the current blocktime
    if (diff <= 0) return String(Math.round(start));
    return String(blockTimestamp);
}

module.exports = { getStartSaleTimestamp, getCurrentBlockTimestamp };