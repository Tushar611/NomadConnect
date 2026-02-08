import { supabase } from "./supabase";
import * as FileSystem from "expo-file-system/legacy";

const bucketName = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || "uploads";

interface UploadResult {
  success: boolean;
  url: string;
  fileName: string;
  fileType: string;
  size?: number;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function uploadPhoto(uri: string): Promise<UploadResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const extension = match ? match[1].toLowerCase() : "jpg";
    const uniqueName = `photos/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const arrayBuffer = base64ToArrayBuffer(base64);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueName, arrayBuffer, {
        contentType: `image/${extension}`,
        upsert: false,
      });

    if (error) {
      if ((error as any)?.message?.includes("Bucket not found")) {
        throw new Error(`Storage bucket not found. Create a Supabase Storage bucket named "${bucketName}" or set EXPO_PUBLIC_SUPABASE_BUCKET.`);
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      fileName: filename,
      fileType: `image/${extension}`,
      size: fileInfo.size,
    };
  } catch (error) {
    console.error("Photo upload error:", error);
    throw error;
  }
}

export async function uploadFile(uri: string, fileName?: string): Promise<UploadResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const name = fileName || uri.split("/").pop() || `file_${Date.now()}`;
    const extension = name.split(".").pop()?.toLowerCase() || "";
    const uniqueName = `files/${Date.now()}_${Math.random().toString(36).substring(7)}_${name}`;

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
    };

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const arrayBuffer = base64ToArrayBuffer(base64);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueName, arrayBuffer, {
        contentType: mimeTypes[extension] || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      if ((error as any)?.message?.includes("Bucket not found")) {
        throw new Error(`Storage bucket not found. Create a Supabase Storage bucket named "${bucketName}" or set EXPO_PUBLIC_SUPABASE_BUCKET.`);
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      fileName: name,
      fileType: mimeTypes[extension] || "application/octet-stream",
      size: fileInfo.size,
    };
  } catch (error) {
    console.error("File upload error:", error);
    throw error;
  }
}

export async function uploadAudio(uri: string, fileName?: string): Promise<UploadResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const name = fileName || uri.split("/").pop() || `audio_${Date.now()}.m4a`;
    const uniqueName = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}_${name}`;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const arrayBuffer = base64ToArrayBuffer(base64);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueName, arrayBuffer, {
        contentType: "audio/m4a",
        upsert: false,
      });

    if (error) {
      if ((error as any)?.message?.includes("Bucket not found")) {
        throw new Error(`Storage bucket not found. Create a Supabase Storage bucket named "${bucketName}" or set EXPO_PUBLIC_SUPABASE_BUCKET.`);
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      fileName: name,
      fileType: "audio/m4a",
      size: fileInfo.size,
    };
  } catch (error) {
    console.error("Audio upload error:", error);
    throw error;
  }
}
