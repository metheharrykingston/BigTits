import { registerPlugin } from '@capacitor/core';
import type { AutomationBundle, FillPageResult, PortalEvent } from '@shared';

export interface PortalWorkspacePlugin {
  open(options: { bundle: AutomationBundle }): Promise<{ sessionId: string }>;
  close(): Promise<void>;
  fillCurrentPage(): Promise<FillPageResult>;
  addListener(
    eventName: 'portalEvent',
    listenerFunc: (event: PortalEvent) => void,
  ): Promise<import('@capacitor/core').PluginListenerHandle>;
}

export const PortalWorkspace = registerPlugin<PortalWorkspacePlugin>('PortalWorkspace', {
  web: () => import('./portal-workspace.web').then((m) => new m.PortalWorkspaceWeb()),
});