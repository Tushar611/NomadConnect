import { View } from "react-native";

export const MapView = View;
export const Marker = View;
export const Callout = View;
export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = null;
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
export const mapsAvailable = false;
