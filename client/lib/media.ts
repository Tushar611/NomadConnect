import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

const getFilenameFromUrl = (url: string, fallback = "download") => {
  try {
    const clean = url.split("?")[0];
    const parts = clean.split("/");
    const name = parts[parts.length - 1];
    return name || fallback;
  } catch {
    return fallback;
  }
};

const createFileFromDataUri = async (dataUri: string, filename: string) => {
  const matches = dataUri.match(/^data:(.*);base64,(.*)$/);
  if (!matches) {
    throw new Error("Invalid data uri");
  }
  const base64 = matches[2];
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
};

export const saveImageToGallery = async (uri: string, filename?: string) => {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Media library permission denied");
  }

  let localUri = uri;
  const name = filename || getFilenameFromUrl(uri, "image.jpg");

  if (uri.startsWith("data:")) {
    localUri = await createFileFromDataUri(uri, name);
  } else if (uri.startsWith("http")) {
    const download = await FileSystem.downloadAsync(
      uri,
      `${FileSystem.cacheDirectory}${name}`
    );
    localUri = download.uri;
  }

  await MediaLibrary.saveToLibraryAsync(localUri);
};

export const saveFileToDevice = async (uri: string, filename?: string) => {
  const name = filename || getFilenameFromUrl(uri, "file");
  let localUri = uri;

  if (uri.startsWith("http")) {
    const download = await FileSystem.downloadAsync(
      uri,
      `${FileSystem.cacheDirectory}${name}`
    );
    localUri = download.uri;
  }

  if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error("Storage permission denied");
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = "application/octet-stream";
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      name,
      mimeType
    );
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri);
  }
};
