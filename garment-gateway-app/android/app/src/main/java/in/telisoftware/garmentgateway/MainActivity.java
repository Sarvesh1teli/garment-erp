package in.telisoftware.garmentgateway;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsGatewayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
