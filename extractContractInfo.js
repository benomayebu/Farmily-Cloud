const fs = require('fs');
const path = require('path');

const contractJsonPath = path.join(__dirname, 'build', 'contracts', 'ProductManagement.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));

const contractInfo = {
  abi: contractJson.abi,
  address: contractJson.networks['5777'].address
};

// Ensure the public/js directory exists
const publicJsDir = path.join(__dirname, 'public', 'js');
if (!fs.existsSync(publicJsDir)){
    fs.mkdirSync(publicJsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(publicJsDir, 'contractInfo.js'),
  `const CONTRACT_INFO = ${JSON.stringify(contractInfo, null, 2)};`
);

console.log('Contract info extracted to public/js/contractInfo.js');