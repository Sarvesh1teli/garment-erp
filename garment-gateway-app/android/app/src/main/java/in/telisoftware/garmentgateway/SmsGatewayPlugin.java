package in.telisoftware.garmentgateway;

import android.Manifest;
import android.telephony.SmsManager;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "SmsGateway",
    permissions = {
        @Permission(
            strings = { Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE },
            alias = "sms"
        )
    }
)
public class SmsGatewayPlugin extends Plugin {
    @PluginMethod
    public void startQueue(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "queuePermissionCallback");
            return;
        }
        startQueueService(call);
    }

    @PermissionCallback
    private void queuePermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            startQueueService(call);
        } else {
            call.reject("SMS permission was denied");
        }
    }

    private void startQueueService(PluginCall call) {
        String token = call.getString("token", "").trim();
        String apiUrl = call.getString("apiUrl", "").trim();
        if (token.isEmpty() || apiUrl.isEmpty()) {
            call.reject("Gateway token and API URL are required");
            return;
        }
        Intent intent = new Intent(getContext(), SmsQueueService.class);
        intent.setAction(SmsQueueService.ACTION_START);
        intent.putExtra("token", token);
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("delaySeconds", call.getInt("delaySeconds", 5));
        intent.putExtra("batchLimit", call.getInt("batchLimit", 300));
        intent.putExtra("pauseAfter", call.getInt("pauseAfter", 50));
        intent.putExtra("pauseSeconds", call.getInt("pauseSeconds", 120));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopQueue(PluginCall call) {
        Intent intent = new Intent(getContext(), SmsQueueService.class);
        intent.setAction(SmsQueueService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }
        send(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            send(call);
        } else {
            call.reject("SMS permission was denied");
        }
    }

    private void send(PluginCall call) {
        String to = call.getString("to", "").replaceAll("[^0-9+]", "");
        String message = call.getString("message", "");
        if (to.length() < 10) {
            call.reject("Valid recipient phone is required");
            return;
        }
        if (message.trim().isEmpty()) {
            call.reject("SMS message is required");
            return;
        }
        try {
            SmsManager sms = SmsManager.getDefault();
            ArrayList<String> parts = sms.divideMessage(message);
            if (parts.size() == 1) {
                sms.sendTextMessage(to, null, parts.get(0), null, null);
            } else {
                sms.sendMultipartTextMessage(to, null, parts, null, null);
            }
            JSObject result = new JSObject();
            result.put("status", "SENT");
            result.put("parts", parts.size());
            call.resolve(result);
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "Could not send SMS" : ex.getMessage());
        }
    }
}
