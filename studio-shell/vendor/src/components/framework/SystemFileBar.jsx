import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StandardProgramMenu from '@/components/ui/design-system/StandardProgramMenu';
import { useWhiteLabel } from '@/lib/whiteLabelStore';
import { base44 } from '@/api/base44Client';
import { FILE_ACTION, fileMenuEnvelope, routeFileAction } from '@/lib/fileMenuContract.mjs';
import { useSaveGuidelines } from '@/lib/useUserSettings';
import { toast } from 'sonner';

// The frame is the headless file ceiling. Products contribute semantics; Switchboard owns routing.
const FileActions = createContext(null);
function OwnedFrame({ children }) {
  const [actions, setActions] = useState(null);
  const owner = useRef(null);
  const [register] = useState(() => (token, value) => {
    owner.current = token;
    setActions(value);
    return () => {
      if (owner.current === token) { owner.current = null; setActions(null); }
    };
  });
  return <FileActions.Provider value={{ actions, register }}>{children}</FileActions.Provider>;
}

/* The OUTERMOST frame wins. A window already owns one, and a surface inside it
   that opened a second would take the registrations while the window's bar kept
   reading an empty frame — the menu would exist and act on nothing. So a frame
   opened under another is a pass-through. */
export function SystemFileFrame({ children }) {
  const parent = useContext(FileActions);
  return parent ? <>{children}</> : <OwnedFrame>{children}</OwnedFrame>;
}

export function useHasFileFrame() {
  return useContext(FileActions) !== null;
}

export function useSystemFileActions(actions) {
  const frame = useContext(FileActions);
  const token = useRef(Symbol('file-actions'));
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => frame?.register(token.current, {
    onNew: (...args) => latest.current?.onNew?.(...args),
    onSave: (...args) => latest.current?.onSave?.(...args),
    onSaveAs: (...args) => latest.current?.onSaveAs?.(...args),
    onOpen: (...args) => latest.current?.onOpen?.(...args),
    onExport: (...args) => latest.current?.onExport?.(...args),
    onShare: (...args) => latest.current?.onShare?.(...args),
    onRoute: (...args) => latest.current?.onRoute?.(...args),
    saveEnabled: actions?.saveEnabled,
    exportEnabled: actions?.exportEnabled,
    shareEnabled: actions?.shareEnabled,
    status: actions?.status,
    surfaceRef: actions?.surfaceRef,
    workRef: actions?.workRef,
    artifactRef: actions?.artifactRef,
    saveTargets: actions?.saveTargets || [],
    saveGuidelines: actions?.saveGuidelines || {},
  }), [
    frame?.register, actions?.saveEnabled, actions?.exportEnabled, actions?.shareEnabled,
    actions?.status, actions?.surfaceRef, actions?.workRef, actions?.artifactRef,
    actions?.saveTargets, actions?.saveGuidelines,
  ]);
}

export function SystemFileBar({ appName, surfaceRef, workRef, artifactRef = null, className, onSettings }) {
  const navigate = useNavigate();
  const frame = useContext(FileActions);
  const whiteLabel = useWhiteLabel();
  const actions = frame?.actions;

  /* The ranking policy the Save menu sorts targets by.
   *
   * `rankSaveTargets` reads `preferred_classes` and `preferred_providers`, and
   * until now every surface passed `{}` — so the menu ranked against a policy
   * nobody could state, because there was nowhere to state it. A surface that
   * declares its own guidelines still wins; a surface that declares none falls
   * back to the operator's stored ones, so the order a person set in their own
   * settings is the order the menu actually offers. */
  const userGuidelines = useSaveGuidelines();
  const declared = actions?.saveGuidelines;
  const guidelines = declared && Object.keys(declared).length ? declared : userGuidelines;

  const surface = surfaceRef || actions?.surfaceRef || `surface:${appName}`;
  const work = workRef || actions?.workRef || surface;
  const artifact = artifactRef || actions?.artifactRef || null;

  const route = async (action, envelope) => {
    try {
      const request = envelope || fileMenuEnvelope(action, {
        surface_ref: surface, work_ref: work, artifact_ref: artifact,
      });
      const result = await routeFileAction(base44, request);
      if (result?.admitted) toast.success(`${action} admitted by Switchboard`);
      else toast.warning(result?.first_red || `${action} was not admitted`);
      actions?.onRoute?.(result);
      return result;
    } catch (error) {
      const firstRed = error?.message || 'FILE_ROUTE_FAILED';
      toast.error(firstRed);
      actions?.onRoute?.({ routed: false, admitted: false, first_red: firstRed });
      return null;
    }
  };

  /* Switchboard is the ceiling, so admission happens BEFORE the product mutates.
     Calling the local save first would leave the floor open: a denied route could
     still have written a file. Only a routed need may cross into the product
     action. */
  const handler = (action, local) => async (envelope) => {
    const result = await route(action, envelope);
    if (!result?.admitted) return result;
    await local?.(envelope, result);
    return result;
  };

  /* An action the surface never bound is a menu item that is OFF. It used to be
     wired to the router regardless, so pressing Save on a surface with nothing to
     save raised a need for work no one could do. */
  const bound = (action, local) => (typeof local === 'function' ? handler(action, local) : undefined);

  return <StandardProgramMenu
    appName={appName}
    className={className}
    whiteLabel={whiteLabel}
    surfaceRef={surface}
    workRef={work}
    artifactRef={artifact}
    saveTargets={actions?.saveTargets || []}
    saveGuidelines={guidelines}
    onSettings={onSettings || (() => navigate(`/Settings?tab=personalization&return=${encodeURIComponent(window.location.pathname + window.location.search)}`))}
    onNew={bound(FILE_ACTION.NEW, actions?.onNew)}
    onSave={bound(FILE_ACTION.SAVE, actions?.saveEnabled ? actions?.onSave : null)}
    onSaveAs={bound(FILE_ACTION.SAVE_AS, actions?.onSaveAs)}
    onOpen={bound(FILE_ACTION.OPEN, actions?.onOpen)}
    onExport={bound(FILE_ACTION.EXPORT, actions?.exportEnabled ? actions?.onExport : null)}
    onShare={bound(FILE_ACTION.SHARE, actions?.onShare)}
    fileStatus={actions?.status || 'File actions route through Switchboard; provider effects require readback.'}
  />;
}
