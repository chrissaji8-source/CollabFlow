import { DocumentMetadata, VersionSnapshot, CRDTStats } from '../types.js';

const API_BASE = window.location.origin.includes('localhost:5173')
  ? 'http://localhost:4000/api'
  : '/api';

export async function fetchDocuments(): Promise<DocumentMetadata[]> {
  const res = await fetch(`${API_BASE}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  const data = await res.json();
  return data.documents;
}

export async function createDocument(
  title: string,
  type: 'document' | 'whiteboard' = 'document',
  createdBy = 'User',
  icon?: string
): Promise<DocumentMetadata> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, type, createdBy, icon }),
  });
  if (!res.ok) throw new Error('Failed to create document');
  const data = await res.json();
  return data.document;
}

export async function updateDocumentMetadata(
  id: string,
  updates: Partial<DocumentMetadata>
): Promise<DocumentMetadata> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update document');
  const data = await res.json();
  return data.document;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
}

export async function fetchVersionHistory(id: string): Promise<VersionSnapshot[]> {
  const res = await fetch(`${API_BASE}/documents/${id}/versions`);
  if (!res.ok) throw new Error('Failed to fetch versions');
  const data = await res.json();
  return data.versions;
}

export async function createVersionSnapshot(
  roomId: string,
  name: string,
  createdBy: string,
  description?: string
): Promise<VersionSnapshot> {
  const res = await fetch(`${API_BASE}/documents/${roomId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, createdBy, description }),
  });
  if (!res.ok) throw new Error('Failed to create version snapshot');
  const data = await res.json();
  return data.version;
}

export async function restoreVersionSnapshot(roomId: string, versionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${roomId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId }),
  });
  if (!res.ok) throw new Error('Failed to restore version snapshot');
}

export async function fetchCRDTStats(roomId: string): Promise<{
  crdtStats: CRDTStats;
  clientIds: number[];
  structsByClient: Record<string, number>;
  stateVectorBase64: string;
  totalBytes: number;
}> {
  const res = await fetch(`${API_BASE}/documents/${roomId}/crdt-inspect`);
  if (!res.ok) throw new Error('Failed to fetch CRDT stats');
  return res.json();
}

export async function fetchServerStats(): Promise<any> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch server stats');
  return res.json();
}

export function getExportUrl(roomId: string, format: 'markdown' | 'json' = 'json'): string {
  return `${API_BASE}/documents/${roomId}/export?format=${format}`;
}
