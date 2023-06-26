'use strict';

const Homey = require('homey');
const { TwitterClient } = require('twitter-api-client');

module.exports = class TwitterDriver extends Homey.Driver {

  async onInit() {
    this.client = new TwitterClient({
      apiKey: Homey.env.API_KEY,
      apiSecret: Homey.env.API_KEY_SECRET,
      accessToken: Homey.env.ACCESS_TOKEN,
      accessTokenSecret: Homey.env.ACCESS_TOKEN_SECRET,
    });

    this.homey.flow
      .getActionCard('update-status')
      .registerRunListener(async ({ device, status }) => {
        await device.updateStatus({ status });
      });

    this.homey.flow
      .getActionCard('update-status-with-image')
      .registerRunListener(async ({ device, droptoken, status }) => {
        const imageStream = await droptoken.getStream();
        const image = await new Promise((resolve, reject) => {
          const imageBuffers = [];
          imageStream.on('data', chunk => imageBuffers.push(chunk));
          imageStream.once('end', () => {
            const imageBuffer = Buffer.concat(imageBuffers);
            resolve(imageBuffer);
          });
          imageStream.once('error', reject);
        });

        await device.updateStatusWithImage({
          image,
          status,
        });
      });      
  }

  async onPair(session) {
    const devices = [];

    session.setHandler('showView', async viewId => {
      this.log(`View: ${viewId}`);
      if( viewId === 'login_oauth2' ) return onViewLoginOAuth2().catch(err => {
        this.error(err);
        throw err;
      });
    });

    session.setHandler('list_devices', async () => {
      return devices;
    });

    const onViewLoginOAuth2 = async () => {
      // Get Login URL
      const { oauth_token } = await this.client.basics.oauthRequestToken({
        oauth_callback: process.env.CALLBACK_URL,
      });
      const url = `https://api.twitter.com/oauth/authorize?oauth_token=${oauth_token}`
      const callback = await this.homey.cloud.createOAuth2Callback(url);
      callback
        .once('url', url => {
          this.log(`URL: ${url}`);
          session.emit('url', url);
        })
        .once('code', code => {
          this.log(`Code: ${code}`);

          Promise.resolve().then(async () => {
            // Get the User Token
            const token = await this.client.basics.oauthAccessToken({
              oauth_token,
              oauth_verifier: code,
            });

            // Add the Device
            devices.push({
              name: token.screen_name,
              data: {
                user_id: token.user_id,
              },
              store: {
                oauth_token: token.oauth_token,
                oauth_token_secret: token.oauth_token_secret,
              },
            });
          })
            .then(() => session.emit('authorized'))
            .catch(err => session.emit('error', err.message || err.toString()))
        });
      };
  }

}