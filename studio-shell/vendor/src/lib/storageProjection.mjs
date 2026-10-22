export const SOURCE_VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  SHARED: 'SHARED',
  PUBLIC: 'PUBLIC',
  UNKNOWN: 'UNKNOWN',
});

const broadPermission = (permission = {}) =>
  permission.type === 'anyone' || permission.type === 'domain';

export function projectSourceVisibility(source = {}) {
  const permissions = Array.isArray(source.permissions) ? source.permissions : [];
  const broad = permissions.filter(broadPermission);
  if (broad.some((p) => p.type === 'anyone')) {
    return { visibility: SOURCE_VISIBILITY.PUBLIC, basis: 'provider_permission:anyone', verified: true };
  }
  if (broad.length) {
    return { visibility: SOURCE_VISIBILITY.SHARED, basis: 'provider_permission:domain', verified: true };
  }
  if (source.source_visibility_status === 'not_shared' || source.shared === false) {
    return { visibility: SOURCE_VISIBILITY.PRIVATE, basis: 'provider:not_shared', verified: true };
  }
  if (permissions.length && (source.permissions_observed === true || source.source_visibility_status === 'permission_metadata_available')) {
    const owners = permissions.filter(p => p.role === 'owner');
    const otherReaders = permissions.filter(p => p.role !== 'owner');
    if (owners.length && !otherReaders.length) return { visibility: SOURCE_VISIBILITY.PRIVATE, basis: 'provider_permissions:owner_only', verified: true };
    if (otherReaders.length) return { visibility: SOURCE_VISIBILITY.SHARED, basis: 'provider_permissions:named_readers', verified: true };
  }
  if (source.shared === true) {
    return { visibility: SOURCE_VISIBILITY.SHARED, basis: 'provider:shared_without_full_permissions', verified: false };
  }
  return { visibility: SOURCE_VISIBILITY.UNKNOWN, basis: source.source_visibility_status || 'permission_metadata_absent', verified: false };
}

export function storageProjection(source = {}, semantic = {}) {
  const observed = projectSourceVisibility(source);
  return {
    provider: source.provider || 'unknown',
    provider_file_id: source.id || source.file_id || null,
    physical_path: source.path || null,
    provider_visibility: observed.visibility,
    provider_visibility_basis: observed.basis,
    provider_visibility_verified: observed.verified,
    custody_scope: semantic.custody_scope || 'USER',
    semantic_visibility: semantic.visibility || 'UNKNOWN',
    project_ref: semantic.project_ref || null,
    client_ref: semantic.client_ref || null,
    classification_source: semantic.classification_source || null,
  };
}