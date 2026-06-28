import { WebPlugin } from '@capacitor/core';
import type { AutomationBundle, FillPageResult, PortalEvent } from '@shared';
import type { PortalWorkspacePlugin } from './portal-workspace';

/** Browser dev fallback — opens official URL in new tab; no autofill on web. */
export class PortalWorkspaceWeb extends WebPlugin implements PortalWorkspacePlugin {
  async open(options: { bundle: AutomationBundle }): Promise<{ sessionId: string }> {
    window.open(options.bundle.start_url, '_blank', 'noopener,noreferrer');
    return { sessionId: 'web-dev-session' };
  }

  async close(): Promise<void> {
    return;
  }

  async fillCurrentPage(): Promise<FillPageResult> {
    return {
      filled: 0,
      failed: 0,
      paused: true,
      message: 'Portal autofill runs in the Android native module. On iOS/web, open the portal and fill manually.',
    };
  }

  async addListener(
    _eventName: 'portalEvent',
    _listenerFunc: (event: PortalEvent) => void,
  ): Promise<import('@capacitor/core').PluginListenerHandle> {
    return { remove: async () => undefined };
  }
}