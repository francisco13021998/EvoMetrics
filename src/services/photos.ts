import { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { ClientPhoto } from '@/types/domain';

export const PHOTOS_TABLE = 'client_photos';
export const CLIENT_IMAGES_BUCKET = 'client-images';

type DbClientPhotoRow = {
  id: string;
  owner_id: string;
  client_id: string;
  revision_id: string | null;
  storage_path: string;
  type: ClientPhoto['type'];
  captured_at: string;
  created_at: string;
};

export type UploadClientPhotoInput = {
  ownerId: string;
  clientId: string;
  asset: ImagePickerAsset;
  revisionId?: string | null;
  type?: ClientPhoto['type'];
};

function sanitizeFileNameSegment(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getFileExtension(asset: ImagePickerAsset) {
  const fromName = asset.fileName?.split('.').pop()?.trim().toLowerCase();

  if (fromName) {
    return fromName;
  }

  const fromMime = asset.mimeType?.split('/').pop()?.trim().toLowerCase();

  if (fromMime === 'jpeg') {
    return 'jpg';
  }

  if (fromMime) {
    return fromMime;
  }

  return 'jpg';
}

function buildStorageFileName(asset: ImagePickerAsset) {
  const baseName = asset.fileName?.replace(/\.[^.]+$/, '') ?? 'photo';
  const safeBaseName = sanitizeFileNameSegment(baseName) || 'photo';
  const extension = getFileExtension(asset);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${timestamp}-${safeBaseName}-${suffix}.${extension}`;
}

async function getSignedImageUrl(path: string) {
  const { data, error } = await supabase.storage.from(CLIENT_IMAGES_BUCKET).createSignedUrl(path, 60 * 60);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

async function mapDbClientPhoto(row: DbClientPhotoRow): Promise<ClientPhoto> {
  return {
    id: row.id,
    ownerId: row.owner_id,
    clientId: row.client_id,
    revisionId: row.revision_id,
    storagePath: row.storage_path,
    imageUrl: await getSignedImageUrl(row.storage_path),
    type: row.type,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  };
}

async function getFileArrayBuffer(uri: string) {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada.');
  }

  return response.arrayBuffer();
}

function mapCreatePayload(payload: { ownerId: string; clientId: string; revisionId?: string | null; storagePath: string; type: ClientPhoto['type'] }) {
  return {
    owner_id: payload.ownerId,
    client_id: payload.clientId,
    revision_id: payload.revisionId ?? null,
    storage_path: payload.storagePath,
    type: payload.type,
    captured_at: new Date().toISOString(),
  };
}

export const photosService = {
  buildPath(ownerId: string, clientId: string, fileName: string) {
    return `${ownerId}/${clientId}/${fileName}`;
  },

  async listByClient(clientId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(PHOTOS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .eq('owner_id', ownerId)
      .order('captured_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return Promise.all(((data as DbClientPhotoRow[] | null) ?? []).map(mapDbClientPhoto));
  },

  async getById(photoId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(PHOTOS_TABLE)
      .select('*')
      .eq('id', photoId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapDbClientPhoto(data as DbClientPhotoRow) : null;
  },

  async uploadFromDevice({ ownerId, clientId, asset, revisionId, type = 'progress' }: UploadClientPhotoInput) {
    const fileName = buildStorageFileName(asset);
    const storagePath = this.buildPath(ownerId, clientId, fileName);
    const body = await getFileArrayBuffer(asset.uri);
    const contentType = asset.mimeType ?? `image/${getFileExtension(asset)}`;

    const { error: uploadError } = await supabase.storage.from(CLIENT_IMAGES_BUCKET).upload(storagePath, body, {
      contentType,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await supabase
      .from(PHOTOS_TABLE)
      .insert(mapCreatePayload({ ownerId, clientId, revisionId, storagePath, type }))
      .select('*')
      .single();

    if (error) {
      await supabase.storage.from(CLIENT_IMAGES_BUCKET).remove([storagePath]);
      throw new Error(error.message);
    }

    return mapDbClientPhoto(data as DbClientPhotoRow);
  },

  async remove(photoId: string, ownerId: string) {
    const photo = await this.getById(photoId, ownerId);

    if (!photo) {
      throw new Error('La imagen que intentas eliminar no existe.');
    }

    const { error: storageError } = await supabase.storage.from(CLIENT_IMAGES_BUCKET).remove([photo.storagePath]);

    if (storageError) {
      throw new Error(storageError.message);
    }

    const { error } = await supabase
      .from(PHOTOS_TABLE)
      .delete()
      .eq('id', photoId)
      .eq('owner_id', ownerId);

    if (error) {
      throw new Error(error.message);
    }
  },
};