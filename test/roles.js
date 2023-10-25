const web3 = require('web3');
exports.roles = {
    SnapShot: web3.utils.soliditySha3("HEIRLOOMDAO_SNAPSHOT_ROLE"),
    Pauser: web3.utils.soliditySha3("HEIRLOOMDAO_PAUSER_ROLE"),
    Minter: web3.utils.soliditySha3("HEIRLOOMDAO_MINTER_ROLE"),
    Admin: web3.utils.soliditySha3("HEIRLOOMDAO_ADMIN_ROLE"),
    Escrow: web3.utils.soliditySha3("HEIRLOOMDAO_ESCROW_ROLE"),
    Verifier: web3.utils.soliditySha3("HEIRLOOMDAO_VERIFIER_ROLE"),
    Operator: web3.utils.soliditySha3("HEIRLOOMDAO_OPERATOR_ROLE"),
}