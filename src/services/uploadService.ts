import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../../lib/supabase";
import { sanitizeText } from "../utils/sanitize";
import type {
  GalleryUploadInput,
  TeacherOfferInput,
  TeacherResultInput,
  TeacherTopperInput,
} from "../types/teacher";

type CloudinaryResourceType = "image" | "video" | "raw";

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

const cloudName =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const uploadPreset =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
const rawUploadPreset =
  process.env.EXPO_PUBLIC_CLOUDINARY_RAW_UPLOAD_PRESET || "";

function ensureCloudinaryEnv() {
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing in env");
  }
}

function getUploadPreset(resourceType: CloudinaryResourceType) {
  if (resourceType === "raw" && rawUploadPreset) {
    return rawUploadPreset;
  }
  return uploadPreset;
}

function resolveMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export const uploadService = {
  async pickFile(options?: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
  }): Promise<SelectedFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: options?.type ?? "*/*",
      copyToCacheDirectory: options?.copyToCacheDirectory ?? true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_UPLOAD_BYTES) {
      throw new Error("File too large. Max allowed size is 40MB.");
    }
    return {
      uri: asset.uri,
      name: sanitizeText(asset.name, 120),
      mimeType: asset.mimeType || resolveMimeType(asset.name),
    };
  },

  async uploadToCloudinary(
    file: SelectedFile,
    resourceType: CloudinaryResourceType
  ): Promise<string> {
    ensureCloudinaryEnv();
    const selectedPreset = getUploadPreset(resourceType);

    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as any);
    formData.append("upload_preset", selectedPreset);
    if (resourceType === "raw") {
      formData.append("resource_type", "raw");
    }

    const endpointResource =
      resourceType === "raw" ? "raw" : resourceType === "video" ? "video" : "image";
    const uploadUrl = resourceType === "raw"
      ? `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`
      : `https://api.cloudinary.com/v1_1/${cloudName}/${endpointResource}/upload`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let apiMessage = "";
      try {
        const body = await response.json();
        apiMessage = body?.error?.message || "";
      } catch {
        // ignore parse failures
      }
      const normalized = apiMessage.toLowerCase();
      if (
        normalized.includes("unsigned") &&
        normalized.includes("upload preset")
      ) {
        throw new Error(
          "Cloudinary preset unsigned nahi hai. Dashboard me unsigned preset banao, aur raw files ke liye EXPO_PUBLIC_CLOUDINARY_RAW_UPLOAD_PRESET set karo."
        );
      }
      throw new Error(apiMessage || "Cloudinary upload failed");
    }

    const data = await response.json();
    if (!data?.secure_url) {
      throw new Error("Cloudinary secure_url missing");
    }

    return data.secure_url as string;
  },

  async uploadFile(options: {
    type?: string | string[];
    resourceType: CloudinaryResourceType;
  }): Promise<string> {
    const file = await this.pickFile({ type: options.type });
    if (!file) {
      throw new Error("File selection cancelled");
    }

    return this.uploadToCloudinary(file, options.resourceType);
  },

  async createOffer(input: TeacherOfferInput): Promise<void> {
    const payload = {
      title: sanitizeText(input.title, 120),
      description: sanitizeText(input.description, 500),
      price: input.price,
      valid_till: input.valid_till,
      promo_code: input.promo_code ? sanitizeText(input.promo_code, 40) : null,
      registration_link: sanitizeText(input.registration_link, 300),
      active: true,
      is_active: true,
    };

    const { error } = await supabase.from("offers").insert(payload);

    if (error) {
      throw new Error(error.message || "Unable to create offer");
    }
  },

  async createResult(input: TeacherResultInput): Promise<void> {
    const payload = {
      student_name: sanitizeText(input.student_name, 120),
      exam: sanitizeText(input.exam, 120),
      marks: input.marks,
      year: input.year,
      photo_url: sanitizeText(input.photo_url, 400),
    };

    const firstTry = await supabase.from("results").insert(payload);
    if (!firstTry.error) {
      return;
    }

    const fallback = await supabase.from("public_results").insert(payload);
    if (fallback.error) {
      throw new Error(
        fallback.error.message || firstTry.error.message || "Unable to upload result"
      );
    }
  },

  async createTopper(input: TeacherTopperInput): Promise<void> {
    const { error } = await supabase.from("toppers_top3").insert(input);

    if (error) {
      throw new Error(error.message || "Unable to upload topper");
    }
  },

  async uploadGalleryImage(input: GalleryUploadInput): Promise<void> {
    const { error } = await supabase.from("gallery_images").insert({
      album_id: input.album_id,
      image_url: input.image_url,
      caption: input.caption ?? null,
    });

    if (error) {
      throw new Error(error.message || "Unable to upload gallery image");
    }
  },
};
