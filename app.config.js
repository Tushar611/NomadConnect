const appJson = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return {
    ...appJson,
    android: {
      ...appJson.android,
      config: {
        ...(appJson.android?.config || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};
