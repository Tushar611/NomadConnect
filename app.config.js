const appJson = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo?.android,
        config: {
          ...(appJson.expo?.android?.config || {}),
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        },
      },
    },
  };
};
