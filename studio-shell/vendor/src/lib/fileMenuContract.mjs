import { projectSourceVisibility } from './storageProjection.mjs';

export const FILE_MENU_SCHEMA = 'xiio.switchboard.file-menu/v1';

export const FILE_ACTION = Object.freeze({
  NEW: 'file.new',
  OPEN: 'file.open',
  SAVE: 'file.save',
  SAVE_AS: 'file.save_as',
  EXPORT: 'file.export',
  SHARE: 'file.share',
});

export const STORAGE_CLASS = Object.freeze({
  PRIVATE: 'PRIVATE',
  PROJECT: 'PROJECT',
  PUBLIC: 'PUBLIC',
  UNKNOWN: 'UNKNOWN',
  SHARED: 'SHARED',
});

export const CLOUD_RESOURCE_SCHEMA = 'xiio.bins.cloud-resource/v1';

/* Provider metadata is evidence, not policy. PUBLIC requires an explicit public
   signal. PRIVATE requires an explicit private signal. Everything else remains
   UNKNOWN so an unread permission set can never be promoted to public. */
export function normalizeCloudResource(target = {}) {
  const storage_class = classifyStorageTarget(target);
  return {
    schema: CLOUD_RESOURCE_SCHEMA,
    provider: target.provider || 'UNKNOWN',
    provider_resource_id: target.provider_resource_id || target.file_id || target.id || null,
    provider_parent_id: target.provider_parent_id || target.parent_id || null,
    path: target.path || null,
    name: target.name || target.label || null,
    mime_type: target.mime_type || target.mimeType || null,
    storage_class,
    custody_scope: target.custody_scope || (target.project_ref ? 'PROJECT' : target.client_ref ? 'CLIENT' : 'USER'),
    provider_visibility: projectSourceVisibility(target).visibility,
    provider_visibility_basis: projectSourceVisibility(target).basis,
    provider_visibility_verified: projectSourceVisibility(target).verified,
    visibility: target.visibility || null,
    owner_ref: target.owner_ref || target.owner || null,
    user_ref: target.user_ref || null,
    client_ref: target.client_ref || null,
    project_ref: target.project_ref || null,
    shared: typeof target.shared === 'boolean' ? target.shared : null,
    permissions: Array.isArray(target.permissions) ? target.permissions : [],
    source_visibility_status: target.source_visibility_status || null,
    public: target.public === true,
    permissions_observed: target.permissions_observed === true,
    permission_refs: Array.isArray(target.permission_refs) ? target.permission_refs : [],
    version_ref: target.version_ref || target.revision_id || target.etag || null,
    digest: target.digest || target.sha256 || null,
    bins_ref: target.bins_ref || null,
    observed_at: target.observed_at || null,
  };
}

/* The user owns ingress topology. Switchboard never rewrites it into a canonical
   folder tree. This contract only projects save targets over provider metadata. */
export function classifyStorageTarget(target = {}) {
  if (target.visibility === 'public' || target.public === true) return STORAGE_CLASS.PUBLIC;
  const observed = projectSourceVisibility(target);
  if (observed.visibility === 'PUBLIC') return STORAGE_CLASS.PUBLIC;
  if (observed.visibility === 'PRIVATE') return STORAGE_CLASS.PRIVATE;
  if (observed.visibility === 'SHARED') return STORAGE_CLASS.SHARED;
  if (target.visibility === 'private') return STORAGE_CLASS.PRIVATE;
  return STORAGE_CLASS.UNKNOWN;
}

export function rankSaveTargets(targets = [], guidelines = {}) {
  const preferredProviders = guidelines.preferred_providers || [];
  const preferredClasses = guidelines.preferred_classes || [STORAGE_CLASS.PRIVATE, STORAGE_CLASS.PROJECT, STORAGE_CLASS.PUBLIC];
  return [...targets]
    .map((target, sourceIndex) => ({ ...target, storage_class: classifyStorageTarget(target), sourceIndex }))
    .sort((a, b) => {
      const ac = preferredClasses.indexOf(a.storage_class), bc = preferredClasses.indexOf(b.storage_class);
      const ap = preferredProviders.indexOf(a.provider), bp = preferredProviders.indexOf(b.provider);
      const classRankA = ac < 0 ? 999 : ac, classRankB = bc < 0 ? 999 : bc;
      const providerRankA = ap < 0 ? 999 : ap, providerRankB = bp < 0 ? 999 : bp;
      return classRankA - classRankB || providerRankA - providerRankB || a.sourceIndex - b.sourceIndex;
    });
}

export function fileMenuEnvelope(action, { surface_ref, work_ref, artifact_ref = null, target = null, format = null } = {}) {
  if (!Object.values(FILE_ACTION).includes(action)) throw new Error('FILE_ACTION_UNDECLARED');
  if (!surface_ref) throw new Error('FILE_SURFACE_REQUIRED');
  return {
    schema: FILE_MENU_SCHEMA,
    action,
    surface_ref,
    work_ref: work_ref || surface_ref,
    artifact_ref,
    target: target ? normalizeCloudResource(target) : null,
    format,
    requested_at: new Date().toISOString(),
  };
}

export function dispatchFileAction(action, context = {}) {
  const detail = fileMenuEnvelope(action, context);
  window.dispatchEvent(new CustomEvent('xiio:file-menu', { detail }));
  return detail;
}

/* The UI publishes intent. Switchboard owns routing and provider selection. */
export async function routeFileAction(base44, envelope) {
  if (!base44?.functions?.invoke) throw new Error('FILE_SWITCHBOARD_UNAVAILABLE');
  const response = await base44.functions.invoke('fileMenu', envelope);
  return response?.data ?? response;
}