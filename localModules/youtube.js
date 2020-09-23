var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var youtube = new google.youtube_v3.Youtube('v3');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/youtube'];

var CREDS_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = CREDS_DIR + '_google_token.json';
var VIDEO_ID_PATH = CREDS_DIR + '_video_id.json';
var PLAYLIST_PATH = CREDS_DIR + 'playlistID.json';
var YT_CREDS = CREDS_DIR +  'youtubeCREDS.json';

var purgeCache = require('./purgeCache');
var debug = require('./debug').debug;

var credentials = JSON.stringify(YT_CREDS);

/**
 * Reads in Youtube JSON credentials, parses it then sends to the authorize() function and runs the Youtube API function.
 *
 * fs.readfile
 * Reads contents from provided JSON by Youtube for authorizing.
 *
 ** processClientSecrets()
 ** @param err
 ** @param content
 */
module.exports = {
    authCheckInsert(callback) {
        fs.readFile(YT_CREDS, function processClientSecrets(err, content) {

            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }

            authorize(JSON.parse(content), (oauth) => {
                let videoId = require(VIDEO_ID_PATH);
                debug.log('****');
                debug.log('checking playlist for video', videoId);
                debug.log('****');
                checkPlaylist(oauth, videoId, (msgs) => {
                    console.log('checked playlist: ', msgs);
                    if (msgs.length === 0) {
                        insertToPlaylist(oauth, videoId);
                    } else {
                        callback(msgs);
                    }
                });
            });
        });
    },
};


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    // var clientSecret = credentials.installed.client_secret;
    // var clientId = credentials.installed.client_id;
    // var redirectUrl = credentials.installed.redirect_uris[0];
    // var oauth2Client = new googleAuth.OAuth2Client(clientId, clientSecret, redirectUrl);

    const oauth2Client = new googleAuth.OAuth2Client(client_id, client_secret, redirect_uris[0]);

    // var oauth2Client = new auth.OAuth2();
    // var oauth2Client = auth.getClient()

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) { //if not get new token
            getNewToken(oauth2Client, callback);
        } else { //if yes parse json for token
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}


/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('youtube.js:81: Error while trying to retrieve access token', err);
                console.log('\n Try deleting ' + TOKEN_PATH + ' located at ' + CREDS_DIR);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}


/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(CREDS_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            debug.log('youtube.js:101: ')
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);

}

/**
 * Send video id to playlist with YoutubeAPI function
 * @param auth contains authorize information
 */
function insertToPlaylist(auth, videoId) {

    var details = {
        videoId: videoId,
        kind: 'youtube#video'
    };

    var request = {
        userId: 'me',
        auth: auth,
        part: 'snippet',
        resource: {
            snippet: {
                playlistId: require(PLAYLIST_PATH),
                resourceId: details
            }

        }
    };

    debug.log('Sending request..\n'
                    + '  Video ID: ' + JSON.stringify(request.resource.snippet.resourceId.videoId)
                    + '\n  Playlist ID: ' + JSON.stringify(request.resource.snippet.playlistId)
    );
    youtube.playlistItems.insert(request, function (listErr, listResponse) {

        if (listErr != null) {
            debug.log('youtube.js:138: ' + JSON.stringify(listErr));
        }

        else {
            debug.log('Video successfully listed!')
            // callback(videoId);
        }
    });

};
purgeCache(VIDEO_ID_PATH); // Delete the cached video id to prepare for next run


function checkPlaylist(auth, videoId, cb, expectedCount = 0) {
    debug.log('checking playlist for video', videoId, ' expecting', expectedCount);
    youtube.playlistItems.list({
        part: ["snippet"],
        playlistId: require(PLAYLIST_PATH),
        videoId: videoId,
        userId: 'me',
        auth: auth,
    })
      .then(function (response) {
            // Handle the results here (response.result has the parsed body).
            console.log("Response", response);
            let msgs = [];
            if (response.data && response.data.items && Array.isArray(response.data.items)) {
                const items = response.data.items;
                if (items.length > 0 && items.length === expectedCount) {
                    msgs.push(`Added ${items[0].snippet.title} at #${items[0].snippet.position}`);
                } else {
                    for (let i = 0; i < items.length; i++) {
                        let playlistItem = items[i];
                        msgs.push(`Skipped because ${playlistItem.snippet.title} was already #${playlistItem.snippet.position} in the playlist`);
                    }
                }
            }
            console.log('callback msgs: ', msgs);
            cb(msgs);
        },
        err => console.error("Execute error", err)
      );
}
