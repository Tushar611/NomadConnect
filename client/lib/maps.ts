import { View } from "react-native";

let MapViewComponent: any = View;
let MarkerComponent: any = View;
let CalloutComponent: any = View;
let providerDefault: any = null;
let providerGoogle: any = null;
let _mapsAvailable = false;

try {
  const maps = require("react-native-maps");
  MapViewComponent = maps.default;
  MarkerComponent = maps.Marker;
  CalloutComponent = maps.Callout;
  providerDefault = maps.PROVIDER_DEFAULT;
  providerGoogle = maps.PROVIDER_GOOGLE;
  _mapsAvailable = true;
} catch (e) {
  console.warn("react-native-maps not available, using fallback");
}

export const MapView = MapViewComponent;
export const Marker = MarkerComponent;
export const Callout = CalloutComponent;
export const PROVIDER_DEFAULT = providerDefault;
export const PROVIDER_GOOGLE = providerGoogle;
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
export const mapsAvailable = _mapsAvailable;
