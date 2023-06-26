'use strict';

const Homey = require('homey');
const { TwitterClient } = require('twitter-api-client');

module.exports = class TwitterDevice extends Homey.Device {

  async onInit() {
    const {
      oauth_token: accessToken,
      oauth_token_secret: accessTokenSecret,
    } = this.getStore();

    this.client = new TwitterClient({
      apiKey: Homey.env.API_KEY,
      apiSecret: Homey.env.API_KEY_SECRET,
      accessToken: accessToken,
      accessTokenSecret: accessTokenSecret,
    });
  }

  async uploadImage({ image }) {
    const { media_id_string } = await this.client.media.mediaUpload({
      media: image.toString('base64'),
    }).catch(err => {
      this.error(err);
      throw err;
    });;
    return media_id_string;
  }

  async updateStatus({ status }) {
    await this.client.tweets.statusesUpdate({
      status,
    }).catch(err => {
      this.error(err);
      throw err;
    });;
  }

  async updateStatusWithImage({ status, image }) {
    const mediaId = await this.uploadImage({ image });
    await this.client.tweets.statusesUpdate({
      status,
      media_ids: mediaId,
    }).catch(err => {
      this.error(err);
      throw err;
    });
  }

}