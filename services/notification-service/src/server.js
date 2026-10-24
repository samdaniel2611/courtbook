require('dotenv').config();
const amqp = require('amqplib');
const { setupConsumer } = require('./consumer');
const { handleMessage } = require('./handler');

const log = (message) => console.log(message);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start() {
  let delay = 1000;
  while (true) {
    let connection;
    try {
      if (!process.env.RABBITMQ_URL) throw new Error('missing broker URL');
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      connection.on('error', () => log('RabbitMQ connection error'));
      connection.on('close', () => log('RabbitMQ connection closed'));
      const channel = await connection.createChannel();
      await setupConsumer(channel, handleMessage, log);
      log('Notification consumer connected');
      return { connection, channel };
    } catch (_error) {
      if (connection) await connection.close().catch(() => {});
      log('RabbitMQ unavailable; retrying');
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

if (require.main === module) start();
module.exports = { start };
