const axios = require('axios');

const GEOAPIFY_GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/search';

async function geocodeAddress(address) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY is not set');
  }

  let response;
  try {
    response = await axios.get(GEOAPIFY_GEOCODING_URL, {
      params: {
        text: address,
        apiKey,
        limit: 1,
      },
      timeout: 5000,
    });
  } catch (error) {
    const status = error.response && error.response.status;
    if (status) {
      throw new Error(`Geoapify geocoding request failed with HTTP status ${status}`);
    }
    throw new Error('Geoapify geocoding request failed due to a network or timeout error');
  }

  const properties = response.data?.features?.[0]?.properties;
  if (!properties || typeof properties.lat !== 'number' || typeof properties.lon !== 'number') {
    return null;
  }

  return { lat: properties.lat, lng: properties.lon };
}

module.exports = geocodeAddress;
