package com.harrykingston.bigtits;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.govcopilot.portalworkspace.PortalWorkspacePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PortalWorkspacePlugin.class);
        super.onCreate(savedInstanceState);
    }
}