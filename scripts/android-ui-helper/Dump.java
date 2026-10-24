package app.aiplayed.uicheck;

import android.app.Activity;
import android.app.Instrumentation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Rect;
import android.media.MediaScannerConnection;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Xml;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import org.xmlpull.v1.XmlSerializer;
import java.io.StringWriter;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** CI-only inspector. Reads live nodes without UiAutomator's animation-idle wait. */
public final class Dump extends Instrumentation {
  private Bundle options;
  @Override public void onCreate(Bundle args) { super.onCreate(args); options = args; start(); }
  @Override public void onStart() {
    Bundle result = new Bundle();
    try {
      if ("scan".equals(options.getString("action"))) {
        CountDownLatch complete = new CountDownLatch(1);
        MediaScannerConnection.scanFile(getContext(), new String[]{options.getString("path")}, new String[]{options.getString("mime", "audio/mpeg")}, (path, uri) -> {
          if (uri != null) result.putString("scanned", uri.toString());
          complete.countDown();
        });
        if (!complete.await(60, TimeUnit.SECONDS) || result.getString("scanned") == null)
          throw new IllegalStateException("Fixture scan did not complete");
        finish(Activity.RESULT_OK, result); return;
      }
      if ("rotate".equals(options.getString("action"))) {
        rotate(); result.putString("action", "rotated"); finish(Activity.RESULT_OK, result); return;
      }
      AccessibilityServiceInfo info = getUiAutomation().getServiceInfo();
      info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
      getUiAutomation().setServiceInfo(info);
      AccessibilityNodeInfo root = null;
      for (int attempt = 0; root == null && attempt < 20; attempt++) {
        root = getUiAutomation().getRootInActiveWindow();
        if (root == null) Thread.sleep(100);
      }
      if (root == null) throw new IllegalStateException("No active accessibility window");
      StringWriter output = new StringWriter();
      XmlSerializer xml = Xml.newSerializer(); xml.setOutput(output);
      xml.startDocument("UTF-8", true); xml.startTag(null, "hierarchy");
      write(xml, root, 0); xml.endTag(null, "hierarchy"); xml.endDocument();
      result.putString("tree", output.toString()); finish(Activity.RESULT_OK, result);
    } catch (Exception error) {
      result.putString("error", error.toString()); finish(Activity.RESULT_CANCELED, result);
    }
  }
  private static String text(CharSequence value) { return value == null ? "" : value.toString(); }
  private void rotate() throws Exception {
    float cx = Float.parseFloat(options.getString("cx")), cy = Float.parseFloat(options.getString("cy"));
    float radius = Float.parseFloat(options.getString("radius")), degrees = Float.parseFloat(options.getString("degrees"));
    long down = SystemClock.uptimeMillis();
    for (int i = 0; i <= 24; i++) {
      double angle = Math.toRadians(-90 + degrees * i / 24);
      MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), i == 0 ? MotionEvent.ACTION_DOWN : MotionEvent.ACTION_MOVE, cx + (float)Math.cos(angle)*radius, cy + (float)Math.sin(angle)*radius, 0);
      event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
      if (!getUiAutomation().injectInputEvent(event, true)) throw new IllegalStateException("Rotation input rejected");
      event.recycle(); Thread.sleep(20);
    }
    double end = Math.toRadians(-90 + degrees);
    MotionEvent up = MotionEvent.obtain(down, SystemClock.uptimeMillis(), "true".equals(options.getString("cancel")) ? MotionEvent.ACTION_CANCEL : MotionEvent.ACTION_UP, cx + (float)Math.cos(end)*radius, cy + (float)Math.sin(end)*radius, 0);
    up.setSource(InputDevice.SOURCE_TOUCHSCREEN); getUiAutomation().injectInputEvent(up, true); up.recycle();
  }
  private static void write(XmlSerializer xml, AccessibilityNodeInfo node, int index) throws Exception {
    if (!node.isVisibleToUser()) return;
    Rect rect = new Rect(); node.getBoundsInScreen(rect);
    xml.startTag(null, "node");
    xml.attribute(null, "index", String.valueOf(index));
    xml.attribute(null, "text", text(node.getText()));
    xml.attribute(null, "content-desc", text(node.getContentDescription()));
    xml.attribute(null, "resource-id", text(node.getViewIdResourceName()));
    xml.attribute(null, "class", text(node.getClassName()));
    xml.attribute(null, "package", text(node.getPackageName()));
    xml.attribute(null, "selected", String.valueOf(node.isSelected()));
    xml.attribute(null, "clickable", String.valueOf(node.isClickable()));
    xml.attribute(null, "enabled", String.valueOf(node.isEnabled()));
    xml.attribute(null, "scrollable", String.valueOf(node.isScrollable()));
    AccessibilityNodeInfo.RangeInfo range = node.getRangeInfo();
    if (range != null) xml.attribute(null, "range-current", String.valueOf(range.getCurrent()));
    xml.attribute(null, "bounds", "["+rect.left+","+rect.top+"]["+rect.right+","+rect.bottom+"]");
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo child = node.getChild(i);
      if (child != null) write(xml, child, i);
    }
    xml.endTag(null, "node");
  }
}
