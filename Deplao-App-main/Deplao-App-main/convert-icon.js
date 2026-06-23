const pngToIco = require('png-to-ico');
const fs = require('fs');

pngToIco('icon.png')
  .then(buf => {
    fs.writeFileSync('icon.ico', buf);
    console.log('Icon created successfully');
  })
  .catch(console.error);
