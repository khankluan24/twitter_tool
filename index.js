const OAuth = require('oauth-1.0a');
const axios = require('axios')
const crypto = require('crypto');
const express = require('express');//Set up the express module
const app = express();
const router = express.Router();
const fs = require('fs')
const consumerKey = '3nVuSoBZnx6U4vzUxf5w';
const consumerSecret = 'Bcs59EFbbsdF6Sl9Ng71smgStWEGwXXKSjYvPVt7qys';
const oauthSignatureMethod = 'HMAC-SHA1';
const oauthRealm = 'http://api.twitter.com/';
const oauthVersion = '1.0';
const path = require('path')
const tokens = fs.readFileSync(path.join(process.cwd(), 'tokens.txt'), 'utf-8').trim().split('\n')
function generateRandomNumericString(length = 31) {
  const randomDigits = Array.from({ length: 31 }, () => Math.floor(Math.random() * 10));
  return randomDigits.join('');
}
function generateOAuthTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}
function generate_url(baseURL, tweetID, cursor = '') {
  let features = { "longform_notetweets_inline_media_enabled": true, "super_follow_badge_privacy_enabled": true, "longform_notetweets_rich_text_read_enabled": true, "super_follow_user_api_enabled": true, "unified_cards_ad_metadata_container_dynamic_card_content_query_enabled": true, "super_follow_tweet_api_enabled": true, "hidden_profile_likes_enabled": true, "hidden_profile_subscriptions_enabled": true, "android_graphql_skip_api_media_color_palette": true, "creator_subscriptions_tweet_preview_api_enabled": true, "freedom_of_speech_not_reach_fetch_enabled": true, "tweetypie_unmention_optimization_enabled": true, "longform_notetweets_consumption_enabled": true, "subscriptions_verification_info_enabled": true, "blue_business_profile_image_shape_enabled": true, "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true, "super_follow_exclusive_tweet_notifications_enabled": true }
  let variables;
  if (baseURL.includes('ConversationTimelineV2')) {
    variables = `{"referrer":"profile","includeTweetImpression":true,"includeHasBirdwatchNotes":false,"isReaderMode":false,"includeEditPerspective":false,"includeEditControl":true,"focalTweetId":${tweetID},"includeCommunityTweetRelationship":true,"includeTweetVisibilityNudge":true}`
    if (cursor !== '') {
      _cursor = `"cursor":"${cursor}",`
      variables = variables.slice(0, 1) + _cursor + variables.slice(1);
    }
  } else if (baseURL.includes('FavoritersTimeline')) {
    variables = `{"includeTweetImpression":true,"includeHasBirdwatchNotes":false,"includeEditPerspective":false,"tweet_id":"${tweetID}","includeEditControl":true,"includeTweetVisibilityNudge":true}`
    if (cursor !== '') {
      _cursor = `"cursor":"${cursor}",`
      variables = variables.slice(0, 1) + _cursor + variables.slice(1);
    }
  }
  const featuresString = JSON.stringify(features);
  const url = `${baseURL}?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(featuresString)}`;
  return url
}
function generateAuthorization(url, oauthToken, oauthTokenSecret) {
  const oauth = OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    nonce_length: 31,
    signature_method: oauthSignatureMethod,
    realm: oauthRealm,
    version: oauthVersion,
    hash_function: function (base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
  });
  oauth.getNonce = function () {
    return generateRandomNumericString();
  };
  oauth.getTimeStamp = function () {
    return generateOAuthTimestamp();
  };
  const requestData = {
    url: url,
    method: 'GET',
  };
  const authorization = oauth.authorize(requestData, {
    key: oauthToken,
    secret: oauthTokenSecret,
  });
  const headers = oauth.toHeader(authorization);
  return headers
}
async function fetchFavorite(tweetID, maxRetries = 5) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      let cursor = '';
      let haveToNextPage = true
      let usernames = []
      const token = tokens[Math.floor(Math.random() * tokens.length)].replace('\r', '').split('|')
      const oauthToken = token[0]
      const oauthTokenSecret = token[1]
      const base_url = 'https://api.twitter.com/graphql/bV4VbG57f8G1wHaghMNpTQ/FavoritersTimeline';
      while (haveToNextPage) {
        const url = generate_url(base_url, tweetID, cursor);
        const headers_oauth = generateAuthorization(url, oauthToken, oauthTokenSecret)
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: url,
          headers: {
            ...headers_oauth,
            'timezone': 'Asia/Shanghai',
            'os-security-patch-level': '2018-08-05',
            'optimize-body': 'true',
            'accept': 'application/json',
            'x-twitter-client': 'TwitterAndroid',
            'user-agent': 'TwitterAndroid/10.15.0-release.0 (310150000-r-0) SM-G935F/9 (samsung;SM-G935F;samsung;SM-G935F;0;;1;2016)',
            'x-twitter-client-version': '10.15.0-release.0',
            'cache-control': 'no-store',
            'x-twitter-active-user': 'yes',
            'x-twitter-api-version': '5',
            'x-twitter-client-limit-ad-tracking': '0',
            'x-twitter-client-flavor': ''
          }
        };
        const response = await axios.request(config)
        if (response.status == 200) {
          if ('instructions' in response.data.data.timeline_response.timeline) {
            const entries = response.data.data.timeline_response.timeline.instructions[0].entries
            if (entries.length > 0) {
              for (const entry of entries) {
                if (entry.content.__typename === "TimelineTimelineItem") {
                  if ('content' in entry.content) {
                    if (entry.content.content.userResult.hasOwnProperty('result')) {
                      const username = entry.content.content.userResult.result.legacy.screen_name
                      usernames.push(username)
                    }
                  }
                }
                if (entry.content.__typename === "TimelineTimelineCursor") {
                  if (entry.content.cursorType == "Bottom") {
                    haveToNextPage = true
                    cursor = entry.content.value
                    if (cursor === entry.content.value) {
                      haveToNextPage = false
                    }
                  }
                } else {
                  haveToNextPage = false
                }
              }
            } else {
              haveToNextPage = false
            }

          }
        }
      }
      return usernames
    } catch (error) {
      console.error(error)
    }
    await new Promise(r => setTimeout(r, 2000));
    retries++;
  }
}
async function fetchTweet(tweetID, maxRetries = 5) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const token = tokens[Math.floor(Math.random() * tokens.length)].replace('\r', '').split('|')
      const oauthToken = token[0]
      const oauthTokenSecret = token[1]
      const base_url = 'https://api.twitter.com/graphql/0g8DmGsQQHeHA7tSFH1NrA/ConversationTimelineV2';
      let cursor = '';
      let haveToNextPage = true
      let usernames = []
      while (haveToNextPage) {
        const url = generate_url(base_url, tweetID, cursor);
        const headers_oauth = generateAuthorization(url, oauthToken, oauthTokenSecret)
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: url,
          headers: {
            ...headers_oauth,
            'timezone': 'Asia/Shanghai',
            'os-security-patch-level': '2018-08-05',
            'optimize-body': 'true',
            'accept': 'application/json',
            'x-twitter-client': 'TwitterAndroid',
            'user-agent': 'TwitterAndroid/10.15.0-release.0 (310150000-r-0) SM-G935F/9 (samsung;SM-G935F;samsung;SM-G935F;0;;1;2016)',
            'x-twitter-client-version': '10.15.0-release.0',
            'cache-control': 'no-store',
            'x-twitter-active-user': 'yes',
            'x-twitter-api-version': '5',
            'x-twitter-client-limit-ad-tracking': '0',
            'x-twitter-client-flavor': ''
          }
        };
        const response = await axios.request(config)
        if (response.status == 200) {
          const entries = response.data.data.timeline_response.instructions[0].entries
          if (entries.length > 0) {
            for (const entry of entries) {
              if (entry.content.__typename === "TimelineTimelineModule") {
                if (entry.content.items[0]) {
                  if ('core' in entry.content.items[0].item.content.tweetResult.result) {
                    const username = entry.content.items[0].item.content.tweetResult.result.core.user_result.result.legacy.screen_name
                    usernames.push(username)
                  }
                }
              }
              if (entry.content.__typename === 'TimelineTimelineItem' && entry.content.content.cursorType === "Bottom") {
                haveToNextPage = true
                cursor = entry.content.content.value
              } else {
                haveToNextPage = false
              }
            }
          } else {
            haveToNextPage = false
          }
        }
      }
      return usernames
    } catch (error) {
      console.error(error)
    }
    await new Promise(r => setTimeout(r, 2000));
    retries++;
  }
}
router.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, './index.html'));
});
app.use('/', router);
router.get('/style/style.css', function (req, res) {
  res.sendFile(path.join(__dirname, './style/style.css'));
});
router.get('/style/home.svg', function (req, res) {
  res.sendFile(path.join(__dirname, './style/home.svg'));
});
router.get('/style/BG-img.png', function (req, res) {
  res.sendFile(path.join(__dirname, './style/BG-img.png'));
});
router.get('/style/BG.png', function (req, res) {
  res.sendFile(path.join(__dirname, './style/BG.png'));
});


app.get('/tweet_reply', async (req, res) => {
  try {
    const tweetID = req.query.tweetID;
    const usernames = await fetchTweet(tweetID);
    res.json({ usernames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching Twitter details' });
  }
});
app.get('/tweet_favorite', async (req, res) => {
  try {
    const tweetID = req.query.tweetID;
    const usernames = await fetchFavorite(tweetID);
    res.json({ usernames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching Twitter favorite details' });
  }
});

app.use(function (req, res, next) {
  res.status(404);
  res.sendFile(__dirname + '/404.html');
});

app.listen(80, function () {
  console.log("App server is running on port 80");
});