const fs = require('fs');
const path = require('path');

const HOME_DIR = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
const CREDS_DIR = '.credentials';
const VIDEO_ID_PATH = path.resolve(HOME_DIR, CREDS_DIR, '_video_id.json');

const purgeCache = require('./purgeCache');
const {debug} = require('./debug');
const {getName} = require('./getName');
const {msg} = require('./userList');

/** Takes complete Slack message object, extracts video id and saves it to VIDEO_ID_PATH
 *
 * @param message, {object} - Parses and strips ID off youtube url - provides console feedback
 *
 ** getYouTubeID Takes url and returns video id in Array[2]
 * @param {string} url
 * @returns {Array[url, removedChars, id]|{index: number, input: string}}
 */

module.exports = function (message, xoxb) {

  function getYouTubeID(url) {
    return decodeURIComponent(url)
      .match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\?v=)([^#\&\?\>]*).*/)
  }

  // console.log('got a message', message);
  // got a message {
  //   client_msg_id: '8aeb39f5-b17a-463e-a832-8d849fbfbf52',
  //     suppress_notification: false,
  //     type: 'message',
  //     text: '<https://www.youtube.com/watch?v=SThqXHuoBNM>',
  //     user: 'UG0G8K3A8',
  //     team: 'T4VAU5EUQ',
  //     blocks: [ { type: 'rich_text', block_id: 'HQF', elements: [Array] } ],
  //     source_team: 'T4VAU5EUQ',
  //     user_team: 'T4VAU5EUQ',
  //     channel: 'C011MQCV54M',
  //     event_ts: '1600870452.004200',
  //     ts: '1600870452.004200'
  // }
  const parsedUrl = getYouTubeID(message.text);  //Passes the text contents of message to getYouTubeID
  const nameId = message.user;

  if (parsedUrl == null) {
    debug.log('ytDigest:message:', getName(nameId) + ': ' + message.text);  //Logs all messages to the console with user name and message text
  } else {

    let id = parsedUrl[2];  //The youtube id is in the third array -see above

    debug.log(`ytDigest:youtubeInsert:${getName(nameId)}:${message.text}`);  //Logs all messages to the console with user name and message text

    fs.writeFile(VIDEO_ID_PATH, JSON.stringify(id), function (error) {  //write the parsed video ID to VIDEO_ID_PATH
      if (error) throw error;
      debug.log('Video ID parsed and stored to: ' + VIDEO_ID_PATH);
    });

    const youtube = require('./youtube');  //call in youtube module now - so it doesn't run prematurely
    youtube.authCheckInsert(messages => {
      msg(xoxb, message.channel, messages.join('\n'));
    });  //run youtube module - youtube module picks up id from VIDEO_ID_PATH

    purgeCache('./youtube');  //Delete cached module to be ready to run again

  } //eof else

}; //eof top function