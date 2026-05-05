const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/inventory',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Total Items: ${json.length}`);
      if (json.length > 0) {
        // Find one of our new items
        const item = json.find(i => i.name === 'TRIPHEN 4 FLU 100ML');
        if (item) {
             console.log('Sample Item:', JSON.stringify(item, null, 2));
        } else {
             console.log('Sample item not found, showing first item:', JSON.stringify(json[0], null, 2));
        }
      }
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
      console.log('Raw data:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
