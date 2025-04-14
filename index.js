const mysql = require('mysql');

exports.handler = async (event, context, callback) => {
  const AWS = require('aws-sdk');

  // Generate IAM auth token for RDS MySQL
  const signer = new AWS.RDS.Signer({
    region: process.env.AWS_REGION,
    hostname: process.env.DB_HOST,
    port: 3306, // change if your DB uses a different port
    username: process.env.DB_USER
  });

  let token;
  try {
    token = await signer.getAuthToken({ username: process.env.DB_USER });
  } catch (err) {
    console.error('Error generating IAM auth token:', err);
    return callback(err);
  }

  // Create MySQL connection using the IAM token as password
  const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: token,
    database: process.env.DB_NAME,
    ssl: 'Amazon RDS' // required for IAM authentication
  });

  connection.connect((err) => {
    if (err) {
      console.error('Connection error:', err);
      return callback(err);
    }

    // Query your view
    connection.query('SELECT * FROM prod_forum.vw_lines', (error, results) => {
      if (error) {
        console.error('Query error:', error);
        callback(error);
      } else {
        callback(null, {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(results)
        });
      }
      connection.end();
    });
  });
};