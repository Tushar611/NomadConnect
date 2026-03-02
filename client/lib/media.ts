import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { getApiUrl } from "@/lib/query-client";

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

const ensureExtension = (name: string, fallbackExt: string) => {
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  return `${name}.${fallbackExt}`;
};

const mimeFromFilename = (name: string) => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    case "mp4":
      return "video/mp4";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
};


const buildDownloadCandidates = (uri: string) => {
  const candidates: string[] = [];
  if (!uri) return candidates;

  candidates.push(uri);

  let apiOrigin = "";
  try {
    apiOrigin = new URL(getApiUrl()).origin;
  } catch {
    apiOrigin = "";
  }

  if (uri.startsWith("/")) {
    try {
      candidates.push(new URL(uri, getApiUrl()).toString());
    } catch {}
  }

  if (/^https?:\/\//i.test(uri) && apiOrigin) {
    try {
      const parsed = new URL(uri);
      const samePathOnApi = `${apiOrigin}${parsed.pathname}${parsed.search}`;
      candidates.push(samePathOnApi);

      const uploadsIndex = parsed.pathname.indexOf("/uploads/");
      if (uploadsIndex >= 0) {
        const uploadsPath = parsed.pathname.slice(uploadsIndex);
        candidates.push(`${apiOrigin}${uploadsPath}`);
      }
    } catch {}
  }

  return Array.from(new Set(candidates));
};

const resolveDownloadUri = (uri: string) => buildDownloadCandidates(uri)[0] || uri;

const ensureLocalUri = async (uri: string, filename: string) => {
  if (uri.startsWith("file://")) return uri;
  if (uri.startsWith("data:")) return createFileFromDataUri(uri, filename);

  const candidates = buildDownloadCandidates(uri).filter((candidate) =>
    candidate.startsWith("http://") || candidate.startsWith("https://")
  );

  let lastError: unknown = null;
  for (const remoteUri of candidates) {
    try {
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const destination = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
      const download = await FileSystem.downloadAsync(remoteUri, destination);
      if (download?.status === 200 && download.uri) {
        return download.uri;
      }
      throw new Error(`Download failed with status ${download?.status ?? "unknown"}`);
    } catch (error) {
      lastError = error;
      // Try encoded URL variant before moving to next candidate.
      try {
        const encoded = encodeURI(remoteUri);
        if (encoded !== remoteUri) {
          const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const destination = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
          const download = await FileSystem.downloadAsync(encoded, destination);
          if (download?.status === 200 && download.uri) {
            return download.uri;
          }
        }
      } catch (error2) {
        lastError = error2;
      }
    }
  }

  if (lastError) throw lastError;
  return resolveDownloadUri(uri);
};


const saveWithStorageAccessFramework = async (localUri: string, name: string) => {
  if (!(Platform.OS === "android" && FileSystem.StorageAccessFramework)) {
    throw new Error("Storage Access Framework unavailable");
  }

  const permissions =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    throw new Error("Storage permission denied");
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mimeType = mimeFromFilename(name);
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    name,
    mimeType
  );
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
};

export const saveImageToGallery = async (uri: string, filename?: string) => {
  const name = ensureExtension(
    filename || getFilenameFromUrl(uri, "image"),
    "jpg"
  );
  const localUri = await ensureLocalUri(uri, name);

  try {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Media library permission denied");
    }
    await MediaLibrary.createAssetAsync(localUri);
    return;
  } catch (error) {
    if (Platform.OS === "android") {
      await saveWithStorageAccessFramework(localUri, name);
      return;
    }
    throw error;
  }
};

export const saveFileToDevice = async (uri: string, filename?: string) => {
  const name = filename || getFilenameFromUrl(uri, "file");
  const localUri = await ensureLocalUri(uri, name);

  if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
    await saveWithStorageAccessFramework(localUri, name);
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri);
    return;
  }

  throw new Error("No save/share method available on this device");
};
