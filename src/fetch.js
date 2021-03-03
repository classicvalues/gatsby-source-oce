/**
 * Copyright (c) 2021 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fetch = require('node-fetch');
const fs = require('fs').promises;

/**
 * This function retrieves all assets found on the provided server/channel pair that
 * match the given query. All these variables are pulled from the plugin configuration
 * set in the gatsby-config.js file found in the calling application.
 * @param {string} contentServer The url for accessing the oce server
 * @param {string} channelToken The publishing channel id used to provide the data
 * @param {number} limit An optional value that can be used to control how many assets
 *  are downloaded at a time
 * @param {string} query An optional query that can be used to filter which assets will be
 * downloaded from the channel. It defaults to all assets and should only be used when necessary
 * to avoid the risk of having assets with unresolvable references.
 * @param {boolean} debug An optional query defaulting to false. If true, it logs the JSON
 * data retrieved from the OCE server.
 */

exports.all = async (contentServer, channelToken, limit, query, debug) => {
  try {
    await fs.rmdir('.data', { recursive: true });
  } catch (err) {
    console.log(`Warning ${err}`);
  }
  if (debug) {
    await fs.mkdir('.data');
  }
  const fetchLimit = ((limit != null && limit > 0) ? limit : 10);

  const fetchQuery = query ? `&q=${query}` : '';
  const allItemsUrl = `${contentServer}/content/published/api/v1.1/items?limit=${fetchLimit}&offset=0&totalResults=true&offset=0&channelToken=${channelToken}${fetchQuery}`;

  const fetchItem = async (id) => {
    const response = await fetch(
      `${contentServer}/content/published/api/v1.1/items/${id}?channelToken=${channelToken}&expand=all`,
    );
    const item = await response.json();

    // Remove hyphens which can cause issues
    item.type = item.type.replace('-', '');
    if (debug) {
      await fs.writeFile(
        `.data/${id}.json`,
        JSON.stringify(item, null, 2),
        'utf-8',
      );
    }
    return item;
  };

  const fetchAll = async () => {
    // Fetch a response from the apiUrl

    let response = await fetch(allItemsUrl);
    // Parse the response as JSON
    try {
      const data = await response.json();

      // Now, if needed loop through the assets and retrieve any remaining ones above the limit.

      if (data.hasMore) {
        const { totalResults } = data;

        for (let offset = fetchLimit; offset < totalResults; offset += fetchLimit) {
          const partialQuery = allItemsUrl.replace('&offset=0', `&offset=${offset}`);
          // console.log(`partialQuery: ${partialQuery}`);
          response = await fetch(partialQuery);
          const partialData = await response.json();
          data.items = data.items.concat(partialData.items);
        }

      // We have to ensure that the types of any of the items don't have any hyphens.
      // Having a hyphen on a GraphQl index type seems to cause  issues.
      }
      for (let x = 0; x < data.items.length; x += 1) {
        data.items[x].type = data.items[x].type.replace('-', '');
      }

      // console.log(JSON.stringify(data, null, 2));
      if (debug) {
        await fs.writeFile('.data/items.json', JSON.stringify(data), 'utf-8');
      }
      return Promise.all(data.items.map((e) => e.id).map(fetchItem));
    } catch (err) {
      console.log(response);
      throw err;
    }
  };
  const entities = await fetchAll();
  return entities;
};